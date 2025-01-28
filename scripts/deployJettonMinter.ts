import { toNano, beginCell, Address } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';

import { JettonMinter } from '../wrappers/jetton-minter';

// npx blueprint run deployJettonMinter
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

    await minter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(minter.address);
}
