import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type ImpureConfig = {
    owner1: Address;
    owner2: Address;
};

export function impureConfigToCell(config: ImpureConfig): Cell {
    return beginCell().storeAddress(config.owner1).storeAddress(config.owner2).endCell();
}

export class Impure implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new Impure(address);
    }

    static createFromConfig(config: ImpureConfig, code: Cell, workchain = 0) {
        const data = impureConfigToCell(config);
        const init = { code, data };
        return new Impure(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Cell.EMPTY,
        });
    }

    async sendMessage(provider: ContractProvider, via: Sender, value: bigint, body: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body,
        });
    }

    async getOwner1(provider: ContractProvider) {
        const result = await provider.get('owner1', []);
        return result.stack.readAddress();
    }

    async getOwner2(provider: ContractProvider) {
        const result = await provider.get('owner2', []);
        return result.stack.readAddress();
    }

    async getBalance(provider: ContractProvider) {
        const result = await provider.get('balance', []);
        return result.stack.readBigNumber();
    }
}
