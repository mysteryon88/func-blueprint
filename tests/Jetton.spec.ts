import '@ton/test-utils';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';

import { JettonWallet } from '../wrappers/jetton-wallet';
import { JettonMinter } from '../wrappers/jetton-minter';

describe('Jetton', () => {
    let minter_code: Cell;
    let wallet_code: Cell;

    let owner: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;

    let blockchain: Blockchain;
    let wallet1: SandboxContract<JettonWallet>;
    let wallet2: SandboxContract<JettonWallet>;
    let minter: SandboxContract<JettonMinter>;

    beforeAll(async () => {
        minter_code = await compile('jetton-minter');
        wallet_code = await compile('jetton-wallet');

        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('owner');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');

        minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: owner.address,
                    content: beginCell().endCell(),
                    wallet_code: wallet_code,
                },
                minter_code,
            ),
        );

        const deployResult = await minter.sendDeploy(owner.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: minter.address,
            deploy: true,
            success: true,
        });
    });

    beforeEach(async () => {
        wallet1 = blockchain.openContract(
            JettonWallet.createFromConfig(
                {
                    walletOwnerAddress: user1.address,
                    jettonMasterAddress: minter.address,
                    wallet_code: wallet_code,
                },
                wallet_code,
            ),
        );

        wallet2 = blockchain.openContract(
            JettonWallet.createFromConfig(
                {
                    walletOwnerAddress: user2.address,
                    jettonMasterAddress: minter.address,
                    wallet_code: wallet_code,
                },
                wallet_code,
            ),
        );
    });

    it('Mint', async () => {
        await minter.sendMint(owner.getSender(), user1.address, toNano('100'), toNano('0.05'), toNano('1'));

        expect(await wallet1.getJettonBalance()).toBe(toNano('100'));
    });

    it('Transfer', async () => {
        await wallet1.sendTransfer(
            toNano('0.2'),
            user1.getSender(),
            toNano('50'),
            user2.address,
            user1.address,
            null,
            toNano('0.1'),
            null,
        );

        expect(await wallet1.getJettonBalance()).toBe(toNano('50'));
        expect(await wallet2.getJettonBalance()).toBe(toNano('50'));
    });

    it('Burn', async () => {
        await wallet1.sendBurn(user1.getSender(), toNano('0.2'), toNano('5'), user1.address, beginCell().endCell());

        expect(await wallet1.getJettonBalance()).toBe(toNano('45'));
        expect(await minter.getTotalSupply()).toBe(toNano('95'));
    });
});
