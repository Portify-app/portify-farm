const { expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const { evmMine, evmIncreaseTime } = require("./utils");

const MockBEP20 = artifacts.require('libs/MockBEP20');
const PortifyFarm = artifacts.require('PortifyFarm');


contract('Portify farm test', ([alice, bob, carol, minter]) => {
    beforeEach(async () => {
        this.pfy = await MockBEP20.new('PFYToken', 'PFY', '1000000000', { from: minter });
        this.lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
        this.lp2 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
        this.lp3 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
        this.rtoken = await MockBEP20.new('RToken', 'RTK', '1000000000', { from: minter });

        this.farm = await PortifyFarm.new(0, { from: minter });
        await this.pfy.transfer(this.farm.address, '1000000', {from:minter});
        await this.rtoken.transfer(this.farm.address, '1000000', {from:minter});
        await this.farm.setMaxBoost(2000, {from: minter});

        await this.lp1.transfer(bob, '2000', { from: minter });
        await this.lp2.transfer(bob, '2000', { from: minter });
        await this.lp3.transfer(bob, '2000', { from: minter });

        await this.lp1.transfer(alice, '2000', { from: minter });
        await this.lp2.transfer(alice, '2000', { from: minter });
        await this.lp3.transfer(alice, '2000', { from: minter });

        await this.lp1.transfer(carol, '2000', { from: minter });
        await this.lp2.transfer(carol, '2000', { from: minter });
        await this.lp3.transfer(carol, '2000', { from: minter });

        await this.farm.add('1000', this.lp1.address, this.pfy.address, true, { from: minter });
        await this.farm.add('1000', this.lp2.address, this.pfy.address,true, { from: minter });
        await this.farm.add('1000', this.lp3.address, this.pfy.address,true, { from: minter });

        await this.lp1.approve(this.farm.address, '2000', { from: bob });
        await this.lp2.approve(this.farm.address, '2000', { from: bob });
        await this.lp3.approve(this.farm.address, '2000', { from: bob });

        await this.lp1.approve(this.farm.address, '2000', { from: alice });
        await this.lp2.approve(this.farm.address, '2000', { from: alice });
        await this.lp3.approve(this.farm.address, '2000', { from: alice });

        await this.lp1.approve(this.farm.address, '2000', { from: carol });
        await this.lp2.approve(this.farm.address, '2000', { from: carol });
        await this.lp3.approve(this.farm.address, '2000', { from: carol });
    });

    // no lock periods, simple mechanic
    it('Simple deposit/withdraw 1 user', async () => {
        await this.farm.deposit(0, '100', 0, { from: alice });
        await this.farm.deposit(0, '50', 0, { from: alice });
        // claim
        await this.farm.deposit(0, '0', 0, { from: alice });

        // deposit balance
        assert.equal((await this.lp1.balanceOf(alice)).toString(), '1850');
        // farmed for 2 blocks alone
        assert.equal((await this.pfy.balanceOf(alice)).toString(), '1999');

        await this.farm.withdraw(0, '75', { from: alice });
        await this.farm.withdraw(0, '75', { from: alice });
        await expectRevert(this.farm.withdraw(0, '1000', { from: alice }), "Withdraw amount exceeds balance");

        assert.equal((await this.lp1.balanceOf(alice)).toString(), '2000');
        assert.equal((await this.pfy.balanceOf(alice)).toString(), '3999');
    });

    it("Simple deposit/withdraw multiple users", async () => {
        await this.farm.deposit(0, '100', 0, { from: alice });
        await this.farm.deposit(0, '100', 0, { from: bob });
        await this.farm.deposit(1, '100', 0, { from: bob });

        // claim
        await this.farm.deposit(0, '0', 0, { from: alice });
        await this.farm.deposit(0, '0', 0, { from: bob });
        await this.farm.deposit(1, '0', 0, { from: bob });

        const res = await this.farm.pendingReward(0, alice);
        assert.equal(res.toString(), '1000');

        // deposit balance
        assert.equal((await this.lp1.balanceOf(alice)).toString(), '1900');
        assert.equal((await this.lp1.balanceOf(bob)).toString(), '1900');
        assert.equal((await this.lp2.balanceOf(bob)).toString(), '1900');

        assert.equal((await this.pfy.balanceOf(alice)).toString(), '2000');
        assert.equal((await this.pfy.balanceOf(bob)).toString(), '4500');

        await this.farm.withdraw(0, '100', { from: alice });
        await this.farm.withdraw(0, '100', { from: bob });
        await this.farm.withdraw(1, '100', { from: bob });

        assert.equal((await this.pfy.balanceOf(alice)).toString(), '3500');
        assert.equal((await this.pfy.balanceOf(bob)).toString(), '9500');
    });

    it("One of deposit tokens used as reward", async () => {
        // create pool where pfy is a deposit token
        await this.farm.add('1000', this.pfy.address, this.rtoken.address,true, { from: minter });
        await this.pfy.transfer(bob, '100', { from: minter });
        await this.pfy.approve(this.farm.address, '100', { from: bob });

        await this.farm.deposit(0, '100', 0, { from: alice });
        await this.farm.deposit(3, '100', 0, { from: bob });
        // claim
        await this.farm.deposit(0, '0', 0, { from: alice });
        await this.farm.deposit(3, '0', 0, { from: bob });

        // deposit balance
        assert.equal((await this.lp1.balanceOf(alice)).toString(), '1900');
        // farmed for 2 blocks alone
        assert.equal((await this.pfy.balanceOf(alice)).toString(), '2000');
        assert.equal((await this.pfy.balanceOf(bob)).toString(), '0');
        assert.equal((await this.rtoken.balanceOf(bob)).toString(), '2000');


        await this.farm.withdraw(0, '100', { from: alice });
        await this.farm.withdraw(3, '100', { from: bob });

        assert.equal((await this.lp1.balanceOf(alice)).toString(), '2000');
        assert.equal((await this.pfy.balanceOf(alice)).toString(), '4000');
        assert.equal((await this.pfy.balanceOf(bob)).toString(), '100');
        assert.equal((await this.rtoken.balanceOf(bob)).toString(), '4000');
    });

    it("Update reward speed on pool", async () => {
        const pfy_reward = await this.farm.rewardTokenPerBlock(this.pfy.address);
        assert.equal(pfy_reward.toString(), '3000');

        await this.farm.deposit(0, '100', 0, { from: alice });
        await this.farm.deposit(0, '0', 0, { from: alice });

        assert.equal((await this.pfy.balanceOf(alice)).toString(), '1000');

        await this.farm.setTokenRewardPerBlock(0, '50', { from: minter });
        await this.farm.withdraw(0, '100', { from: alice });

        assert.equal((await this.lp1.balanceOf(alice)).toString(), '2000');
        assert.equal((await this.pfy.balanceOf(alice)).toString(), '2050');

        const pfy_reward_updated = await this.farm.rewardTokenPerBlock(this.pfy.address);
        assert.equal(pfy_reward_updated.toString(), '2050');
    });

    it("Locking mechanic test", async () => {
        // deposit with max boost
        const deposit_tx = await this.farm.deposit(0, '100', 365 * 24 * 3600, { from: alice });
        const deposit_block = await web3.eth.getBlock(deposit_tx.receipt.blockNumber);
        let res = await this.farm.userInfo(0, alice);

        assert.equal(res.boost.toString(), '2000');
        assert.equal(res.lockUntil.toString(), deposit_block.timestamp +  365 * 24 * 3600);

        await expectRevert(this.farm.withdraw(0, '100', { from: alice }), "Lock is active");

        // claim
        await this.farm.deposit(0, 0, 0, { from: alice });

        // lock not touched
        assert.equal(res.boost.toString(), '2000');
        assert.equal(res.lockUntil.toString(), deposit_block.timestamp +  365 * 24 * 3600);

        // reward doubled
        assert.equal((await this.lp1.balanceOf(alice)).toString(), '1900');
        assert.equal((await this.pfy.balanceOf(alice)).toString(), '4000');

        // deposit same amount without lock, shortening the period
        const deposit_tx_2 = await this.farm.deposit(0, '100', 0, { from: alice });

        assert.equal((await this.pfy.balanceOf(alice)).toString(), '6000');

        const deposit_block_2 = await web3.eth.getBlock(deposit_tx_2.receipt.blockNumber);
        const remaining_lock = res.lockUntil - deposit_block_2.timestamp;
        const new_remaining_lock = Math.floor(remaining_lock / 2)

        res = await this.farm.userInfo(0, alice);

        assert.equal(res.boost.toString(), '1499');
        assert.equal(res.lockUntil.toString(), deposit_block_2.timestamp + new_remaining_lock);

        // move time forward, so the lock is passed
        await evmIncreaseTime(new_remaining_lock);
        await evmMine();
        // move 1 more block and check if boost was not applied after lock is passed
        await evmIncreaseTime(new_remaining_lock);

        await this.farm.withdraw(0, '200', { from: alice });

        const expected_reward = 6000 + Math.floor(1000 * (1499 / 1000)) + 1000;

        assert.equal((await this.lp1.balanceOf(alice)).toString(), '2000');
        assert.equal((await this.pfy.balanceOf(alice)).toString(), expected_reward.toString());
    });

    it("Emergency", async () => {
        await this.farm.deposit(0, '100', 365 * 24 * 3600, { from: alice });

        await expectRevert(this.farm.withdraw(0, '100', { from: alice }), "Lock is active");

        await this.farm.setEmergency(true, { from: minter });
        await this.farm.emergencyWithdraw(0, { from: alice });

        assert.equal((await this.lp1.balanceOf(alice)).toString(), '2000');
        assert.equal((await this.pfy.balanceOf(alice)).toString(), '0');
    });

    it("Sweep", async () => {
        await this.farm.deposit(0, '100', 0, { from: alice });
        await this.lp1.transfer(this.farm.address, '50', { from: minter });

        await expectRevert(this.farm.sweep(this.lp1.address, '100', { from: minter }), "Cant withdraw deposited tokens");
        await this.farm.sweep(this.lp1.address, '50', { from: minter })
    });

});