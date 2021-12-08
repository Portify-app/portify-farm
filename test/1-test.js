const { expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');

const MockBEP20 = artifacts.require('libs/MockBEP20');
const PortifyFarm = artifacts.require('PortifyFarm');


contract('MasterChef', ([alice, bob, carol, minter]) => {
    beforeEach(async () => {
        this.pfy = await MockBEP20.new('PFYToken', 'PFY', '1000000000', { from: minter });
        this.lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
        this.lp2 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
        this.lp3 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
        this.rtoken = await MockBEP20.new('RToken', 'RTK', '1000000', { from: minter });

        this.farm = await PortifyFarm.new(0, { from: minter });
        await this.pfy.transfer(this.farm.address, '1000000', {from:minter});
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

    it("")
    //
    //
    // it('update multiplier', async () => {
    //     await this.farm.add('1000', this.lp1.address, true, { from: minter });
    //     await this.farm.add('1000', this.lp2.address, true, { from: minter });
    //     await this.farm.add('1000', this.lp3.address, true, { from: minter });
    //
    //     await this.lp1.approve(this.farm.address, '100', { from: alice });
    //     await this.lp1.approve(this.farm.address, '100', { from: bob });
    //     await this.farm.deposit(1, '100', { from: alice });
    //     await this.farm.deposit(1, '100', { from: bob });
    //     await this.farm.deposit(1, '0', { from: alice });
    //     await this.farm.deposit(1, '0', { from: bob });
    //
    //     await this.pfy.approve(this.farm.address, '100', { from: alice });
    //     await this.pfy.approve(this.farm.address, '100', { from: bob });
    //     await this.farm.enterStaking('50', { from: alice });
    //     await this.farm.enterStaking('100', { from: bob });
    //
    //     await this.farm.updateMultiplier('0', { from: minter });
    //
    //     await this.farm.enterStaking('0', { from: alice });
    //     await this.farm.enterStaking('0', { from: bob });
    //     await this.farm.deposit(1, '0', { from: alice });
    //     await this.farm.deposit(1, '0', { from: bob });
    //
    //     assert.equal((await this.pfy.balanceOf(alice)).toString(), '700');
    //     assert.equal((await this.pfy.balanceOf(bob)).toString(), '150');
    //
    //     await time.advanceBlockTo('265');
    //
    //     await this.farm.enterStaking('0', { from: alice });
    //     await this.farm.enterStaking('0', { from: bob });
    //     await this.farm.deposit(1, '0', { from: alice });
    //     await this.farm.deposit(1, '0', { from: bob });
    //
    //     assert.equal((await this.pfy.balanceOf(alice)).toString(), '700');
    //     assert.equal((await this.pfy.balanceOf(bob)).toString(), '150');
    //
    //     await this.farm.leaveStaking('50', { from: alice });
    //     await this.farm.leaveStaking('100', { from: bob });
    //     await this.farm.withdraw(1, '100', { from: alice });
    //     await this.farm.withdraw(1, '100', { from: bob });
    //
    // });
});