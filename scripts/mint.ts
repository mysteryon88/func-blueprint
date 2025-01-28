import { toNano, beginCell, Address } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';

import { JettonMinter } from '../wrappers/jetton-minter';

// npx blueprint run mint
export async function run(provider: NetworkProvider) {
    const minter = provider.open(
        JettonMinter.createFromConfig(
            {
                admin: provider.sender().address as Address,
                content: beginCell().endCell(),
                wallet_code: await compile('jetton-wallet'),
            },
            await compile('jetton-minter'),
        ),
    );

    await minter.sendMint(
        provider.sender(),
        provider.sender().address as Address,
        toNano('100'),
        toNano('0.05'),
        toNano('1'),
    );
}
