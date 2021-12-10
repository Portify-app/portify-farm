pragma solidity ^0.8.0;

import './utils/SafeBEP20.sol';
import './utils/Ownable.sol';
import './interfaces/IBEP20.sol';


// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once PFY is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract PortifyFarm is Ownable {
    using SafeBEP20 for IBEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 lockUntil; // timestamp when lock ends
        uint256 boost;
        uint256 lastRewardAt;
        //
        // We do some fancy math here. Basically, any point in time, the amount of PFYs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accRewardPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accRewardPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    uint256 public constant MAX_LOCK_PERIOD = 365 days;
    uint256 public constant BOOST_BASE = 1000;
    // Number, bigger than BOOST_BASE. If we want to get boost = 1.2x, this should be 1200
    uint256 public max_boost = BOOST_BASE;

    // Info of each pool.
    struct PoolInfo {
        IBEP20 depositToken;           // Address of deposit token contract
        IBEP20 rewardToken;            // Address of reward token contract
        uint256 depositedAmount;         // number of deposited tokens
        uint256 lastRewardBlock;  // Last block number that PFYs distribution occurs.
        uint256 accRewardPerShare; // Accumulated reward per share, times 1e12. See below.
        uint256 rewardTokenPerBlock;
    }

    // amount of deposited tokens that cannot be withdrawn by admins
    // we need this because 1 token could be used as a reward and deposit at the same time
    mapping (address => uint256) public depositedTokens;
    // number of this token distributed per block through all the blocks
    mapping (address => uint256) public rewardTokenPerBlock;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // The block number when mining starts.
    uint256 public startBlock;

    bool public emergency;

    event Reward(address indexed user, uint256 indexed pid, uint256 amount);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, uint256 lockUntil);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event NewPool(uint256 rewardTokenPerBlock, IBEP20 depositToken, IBEP20 rewardToken, bool with_update);
    event RewardPerBlockUpdate(uint256 pid, uint256 rewardTokenPerBlock);
    event BoostUpdate(uint256 maxBoost);
    event Emergency(bool state);

    constructor(uint256 _startBlock) {
        startBlock = _startBlock;
    }

    function setMaxBoost(uint256 _max_boost) external onlyOwner {
        require (_max_boost >= BOOST_BASE, 'Low max boost');
        max_boost = _max_boost;

        emit BoostUpdate(max_boost);
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(
        uint256 _rewardTokenPerBlock,
        IBEP20 _depositToken,
        IBEP20 _rewardToken,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        poolInfo.push(PoolInfo({
            depositToken: _depositToken,
            rewardToken: _rewardToken,
            rewardTokenPerBlock: _rewardTokenPerBlock,
            lastRewardBlock: lastRewardBlock,
            depositedAmount: 0,
            accRewardPerShare: 0
        }));
        rewardTokenPerBlock[address(_rewardToken)] += _rewardTokenPerBlock;

        emit NewPool(_rewardTokenPerBlock, _depositToken, _rewardToken, _withUpdate);
    }

    function setTokenRewardPerBlock(uint256 pid, uint256 _rewardTokenPerBlock) external onlyOwner {
        PoolInfo storage pool = poolInfo[pid];

        updatePool(pid);

        rewardTokenPerBlock[address(pool.rewardToken)] -= pool.rewardTokenPerBlock;
        rewardTokenPerBlock[address(pool.rewardToken)] += _rewardTokenPerBlock;

        pool.rewardTokenPerBlock = _rewardTokenPerBlock;

        emit RewardPerBlockUpdate(pid, _rewardTokenPerBlock);
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
        return _to - _from;
    }

    function setEmergency(bool _emergency) external onlyOwner {
        emergency = _emergency;

        emit Emergency(emergency);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        for (uint256 pid = 0; pid < poolInfo.length; pid++) {
            updatePool(pid);
        }
    }


    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        if (pool.depositedAmount == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 newReward = multiplier * pool.rewardTokenPerBlock;
        pool.accRewardPerShare = pool.accRewardPerShare + ((newReward * 1e12) / pool.depositedAmount);
        pool.lastRewardBlock = block.number;
    }

    function _calcPendingReward(UserInfo storage user, uint256 accRewardPerShare) internal view returns (uint256 pending) {
        uint256 userBaseReward = ((user.amount * accRewardPerShare) / 1e12) - user.rewardDebt;
        if (user.lockUntil >= block.timestamp) {
            // user still in lock, apply boost fully
            pending = (userBaseReward * user.boost) / BOOST_BASE;
        } else {
            if (user.lastRewardAt < user.lockUntil) {
                // user has partially boost
                uint256 under_lock_interval = user.lockUntil - user.lastRewardAt;
                uint256 boosted_part = (userBaseReward * under_lock_interval) / (block.timestamp - user.lastRewardAt);
                // boosted part * boost + unmodified part
                pending = ((boosted_part * user.boost) / BOOST_BASE) + (userBaseReward - boosted_part);
            } else {
                // no boost, cause lock is ended before our last claim
                pending = userBaseReward;
            }
        }
    }

    // View function to see pending PFYs on frontend.
    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];

        uint256 accRewardPerShare = pool.accRewardPerShare;
        if (block.number > pool.lastRewardBlock && pool.depositedAmount != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 newReward = multiplier * pool.rewardTokenPerBlock;
            accRewardPerShare += (newReward * 1e12) / pool.depositedAmount;
        }

        return _calcPendingReward(user, accRewardPerShare);
    }

    // Deposit tokens to PortifyFarm for reward allocation.
    function deposit(uint256 _pid, uint256 _amount, uint256 _lock_period) public {
        require (_lock_period <= MAX_LOCK_PERIOD, "Bad lock period");
        require ((_amount > 0) || (_amount == 0 && _lock_period == 0), "Bad input on deposit");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);

        // user deposited something already
        if (user.amount > 0) {
            uint256 pending = _calcPendingReward(user, pool.accRewardPerShare);
            if (pending > 0) {
                pool.rewardToken.safeTransfer(msg.sender, pending);
                emit Reward(msg.sender, _pid, pending);
            }
        // user first deposit
        } else if (_amount > 0) {
            // set lock period + boost based on it
            user.lockUntil = block.timestamp + _lock_period;
            // boost is linearly dependent on lock period
            user.boost = BOOST_BASE + (((max_boost - BOOST_BASE) * _lock_period) / MAX_LOCK_PERIOD);
        }

        if (_amount > 0) {
            // measure delta for deflationary tokens
            uint256 balance_before = pool.depositToken.balanceOf(address(this));
            pool.depositToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            _amount = pool.depositToken.balanceOf(address(this)) - balance_before;

            // if user has deposit already we need update lock and boost
            if (user.amount > 0) {
                uint256 remaining_lock = user.lockUntil <= block.timestamp ? 0 : (user.lockUntil - block.timestamp);
                // update user lock period and boost with weighted average
                uint256 new_lock_period = (remaining_lock * user.amount + _lock_period * _amount) / (user.amount + _amount);
                // set lock period + boost based on it
                user.lockUntil = block.timestamp + new_lock_period;
                // boost is linearly dependent on lock period
                user.boost = BOOST_BASE + (((max_boost - BOOST_BASE) * new_lock_period) / MAX_LOCK_PERIOD);
            }

            // update user deposit amount and stats
            user.amount += _amount;
            pool.depositedAmount += _amount;
            depositedTokens[address(pool.depositToken)] += _amount;
        }
        user.lastRewardAt = block.timestamp;
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;
        emit Deposit(msg.sender, _pid, _amount, user.lockUntil);
    }

    // Withdraw LP tokens from PortifyFarm.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require (user.amount >= _amount, "Withdraw amount exceeds balance");
        require (user.lockUntil <= block.timestamp, "Lock is active");

        updatePool(_pid);
        uint256 pending = _calcPendingReward(user, pool.accRewardPerShare);
        if (pending > 0) {
            pool.rewardToken.safeTransfer(msg.sender, pending);
            emit Reward(msg.sender, _pid, pending);
        }
        if (_amount > 0) {
            user.amount -= _amount;
            pool.depositedAmount -= _amount;
            depositedTokens[address(pool.depositToken)] -= _amount;

            pool.depositToken.safeTransfer(address(msg.sender), _amount);
        }
        user.lastRewardAt = block.timestamp;
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        require (emergency, "Not emergency");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        pool.depositToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);

        depositedTokens[address(pool.depositToken)] -= user.amount;
        pool.depositedAmount -= user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
    }

    function sweep(address token, uint256 amount) external onlyOwner {
        uint256 token_balance = IBEP20(token).balanceOf(address(this));

        require (amount <= token_balance, "Amount exceeds balance");
        require (token_balance - amount >= depositedTokens[token], "Cant withdraw deposited tokens");

        IBEP20(token).safeTransfer(msg.sender, amount);
    }
}