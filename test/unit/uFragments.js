const UFragments = artifacts.require('UFragments.sol');

const _require = require('app-root-path').require;
const { ContractEventSpy } = _require('/util/spies');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

contract('UFragments', function (accounts) {
  let uFragments, snapshot, b;
  const deployer = accounts[0];
  const policy = accounts[1];
  const A = accounts[2];
  const B = accounts[3];
  const C = accounts[4];

  before('setup contract for each test', async function () {
    uFragments = await UFragments.new();
    await uFragments.setMonetaryPolicy(policy, {from: deployer});
  });

  describe('on initialization', function () {
    it('should add +1000 uFragments to the deployer', async function () {
      b = await uFragments.balanceOf.call(deployer);
      expect(b.toNumber()).to.eq(1000);
    });
    it('should set the totalSupply to 1000', async function () {
      b = await uFragments.totalSupply.call();
      expect(b.toNumber()).to.eq(1000);
    });
  });

  describe('Monetary Policy', function () {
    it('should not be set-able by non-owner', async function () {
      await chain.expectEthException(
        uFragments.setMonetaryPolicy(A, { from: policy })
      );
    });
  });

  describe('Transfer', function () {
    before(async function () {
      snapshot = await chain.snapshotChain();
    });
    after(async function () {
      await chain.revertToSnapshot(snapshot);
    });

    describe('deployer transfers 12 to A', function () {
      it('should have balances [988,12]', async function () {
        await uFragments.transfer(A, 12, { from: deployer });
        b = await uFragments.balanceOf.call(deployer);
        expect(b.toNumber()).to.eq(988);
        b = await uFragments.balanceOf.call(A);
        expect(b.toNumber()).to.eq(12);
      });
    });

    describe('deployer transfers 15 to B', async function () {
      it('should have balances [973,15]', async function () {
        await uFragments.transfer(B, 15, { from: deployer });
        b = await uFragments.balanceOf.call(deployer);
        expect(b.toNumber()).to.eq(973);
        b = await uFragments.balanceOf.call(B);
        expect(b.toNumber()).to.eq(15);
      });
    });

    describe('deployer transfers the rest to C', async function () {
      //      it('should have balances [0, 973]');
      it('should have balances [0,973]', async function () {
        await uFragments.transfer(C, 973, { from: deployer });
        b = await uFragments.balanceOf.call(deployer);
        expect(b.toNumber()).to.eq(0);
        b = await uFragments.balanceOf.call(C);
        expect(b.toNumber()).to.eq(973);
      });
    });
  });

  describe('Rebase', async function () {
    describe('Access Controls', function () {
      let rebaseSpy;
      before(async function () {
        snapshot = await chain.snapshotChain();
        await uFragments.transfer(A, 250, { from: deployer });
        rebaseSpy = new ContractEventSpy([uFragments.Rebase]);
        rebaseSpy.watch();
        await uFragments.rebase(1, 500, {from: policy});
      });
      after(async function () {
        rebaseSpy.stopWatching();
        await chain.revertToSnapshot(snapshot);
      });

      it('should be callable by monetary policy', async function () {
        await uFragments.rebase(1, 10, {from: policy});
      });

      it('should not be callable by others', async function () {
        await chain.expectEthException(
          uFragments.rebase(1, 500, { from: deployer })
        );
      });
    });

    describe('Expansion', function () {
      let rebaseSpy;
      // Rebase +500 (50%), with starting balances deployer:750 and A:250.
      before(async function () {
        snapshot = await chain.snapshotChain();
        await uFragments.transfer(A, 250, { from: deployer });
        rebaseSpy = new ContractEventSpy([uFragments.Rebase]);
        rebaseSpy.watch();
        await uFragments.rebase(1, 500, {from: policy});
      });
      after(async function () {
        rebaseSpy.stopWatching();
        await chain.revertToSnapshot(snapshot);
      });

      it('should increase the totalSupply', async function () {
        b = await uFragments.totalSupply.call();
        expect(b.toNumber()).to.eq(1500);
      });
      it('should increase individual balances', async function () {
        b = await uFragments.balanceOf.call(deployer);
        expect(b.toNumber()).to.be.above(750).and.at.most(1125);

        b = await uFragments.balanceOf.call(A);
        expect(b.toNumber()).to.be.above(250).and.at.most(375);
      });
      it('should emit Rebase', async function () {
        const rebaseEvent = rebaseSpy.getEventByName('Rebase');
        expect(rebaseEvent).to.exist;
        expect(rebaseEvent.args.epoch.toNumber()).to.eq(1);
        expect(rebaseEvent.args.totalSupply.toNumber()).to.eq(1500);
      });
    });

    describe('Contraction', function () {
      let rebaseSpy;
      // Rebase -500 (-50%), with starting balances deployer:750 and A:250.
      before(async function () {
        snapshot = await chain.snapshotChain();
        await uFragments.transfer(A, 250, { from: deployer });
        rebaseSpy = new ContractEventSpy([uFragments.Rebase]);
        rebaseSpy.watch();
        await uFragments.rebase(1, -500, {from: policy});
      });
      after(async function () {
        await chain.revertToSnapshot(snapshot);
      });

      it('should decrease the totalSupply', async function () {
        b = await uFragments.totalSupply.call();
        expect(b.toNumber()).to.eq(500);
      });
      it('should decrease individual balances', async function () {
        b = await uFragments.balanceOf.call(deployer);
        expect(b.toNumber()).to.at.least(374).and.at.most(375);

        b = await uFragments.balanceOf.call(A);
        expect(b.toNumber()).to.at.least(124).and.at.most(125);
      });
      it('should emit Rebase', async function () {
        const rebaseEvent = rebaseSpy.getEventByName('Rebase');
        expect(rebaseEvent).to.exist;
        expect(rebaseEvent.args.epoch.toNumber()).to.eq(1);
        expect(rebaseEvent.args.totalSupply.toNumber()).to.eq(500);
      });
    });
  });
});