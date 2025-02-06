import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { KeyPair, getSecureRandomBytes, keyPairFromSeed, sign } from '@ton/crypto';
import { beginCell, Cell, toNano } from '@ton/core';
import { Wallet } from '../wrappers/Wallet';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Wallet', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Wallet');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let wallet: SandboxContract<Wallet>;
    let keys: KeyPair;
    let initBalance: bigint;

    const curTime = () => {
        return blockchain.now ?? Math.floor(Date.now() / 1000);
    };

    beforeEach(async () => {
        initBalance = toNano('100');

        blockchain = await Blockchain.create();

        keys = keyPairFromSeed(await getSecureRandomBytes(32));

        wallet = blockchain.openContract(Wallet.createFromConfig({ seqno: 0, publicKey: keys.publicKey }, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await wallet.sendDeploy(deployer.getSender(), initBalance);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: wallet.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        expect((await wallet.getPublicKey()) == BigInt('0x' + keys.publicKey.toString('hex'))).toBe(true);
        expect((await wallet.getSeqno()) == 0).toBe(true);
        expect((await wallet.getBalance()) <= initBalance).toBe(true);
    });

    it('Check external message', async () => {
        const balanceBefore = await wallet.getBalance();

        const seqNo = await wallet.getSeqno();
        const signedMsg = requestMessage(curTime() + 1000, BigInt(seqNo), keys.secretKey);
        await wallet.sendExternalSignedMessage(signedMsg);

        const balanceAfter = await wallet.getBalance();
        expect((await wallet.getSeqno()) == seqNo + 1).toBe(true);
        expect(balanceBefore > balanceAfter).toBe(true);
    });

    it('Transfer All (mode=128)', async () => {
        const balanceBefore = await wallet.getBalance();

        const internalMsg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(deployer.address)
            .storeCoins(toNano('40'))
            .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeUint(0, 32)
            .endCell();

        const seqNo = await wallet.getSeqno();
        const signedMsg = signRequestWithMessage(curTime() + 1000, BigInt(seqNo), 128, internalMsg, keys.secretKey);

        await wallet.sendExternalSignedMessage(signedMsg);

        const balanceAfter = await wallet.getBalance();
        expect((await wallet.getSeqno()) == seqNo + 1).toBe(true);
        expect(balanceBefore > balanceAfter).toBe(true);
        expect(balanceAfter == 0).toBe(true);
    });
});

function signRequestMessage(msg: Cell, key: Buffer) {
    const signature = sign(msg.hash(), key);
    return beginCell().storeBuffer(signature).storeSlice(msg.asSlice()).endCell();
}

function requestMessage(valid_until: number, seqno: bigint | number, key?: Buffer) {
    const msgBody = beginCell().storeUint(seqno, 32).storeUint(valid_until, 32).endCell();
    return key ? signRequestMessage(msgBody, key) : msgBody;
}

function signRequestWithMessage(valid_until: number, seqno: bigint | number, mode: number, msg: Cell, key: Buffer) {
    const msgBody = beginCell()
        .storeUint(seqno, 32)
        .storeUint(valid_until, 32)
        .storeUint(mode, 8)
        .storeRef(msg)
        .endCell();
    return signRequestMessage(msgBody, key);
}
