import { address, createSolanaRpc } from '@solana/web3.js';
import axios from 'axios';
import { RaydiumTokenInfo } from './types.js';
import { multiplyByZeros } from '../utils.js';

const TOKEN_PROGRAM_ID = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

class SolanaApi {
    private rpcClient = createSolanaRpc(
        'https://holy-omniscient-snow.solana-mainnet.quiknode.pro/e4daf07a992cda9af947c88c3665477250480e39/',
    );

    private raydiumClient = axios.create({
        baseURL: 'https://api-v3.raydium.io',
    });

    async getTokensUsdPrice(addresses: string[]): Promise<Record<string, string>> {
        return (await this.raydiumClient.get(`/mint/price?mints=${addresses.join(',')}`)).data.data;
    }
    async getTokenUsdPrice(address: string): Promise<string> {
        return (await this.getTokensUsdPrice([address]))[address];
    }

    async getTokensInfo(addresses: string[]): Promise<RaydiumTokenInfo[]> {
        return (await this.raydiumClient.get(`/mint/ids?mints=${addresses.join(',')}`)).data.data;
    }

    async getTokenInfo(address: string): Promise<RaydiumTokenInfo> {
        return (await this.getTokensInfo([address]))[0];
    }

    async getTokensByOwner(owner: string) {
        const tokens = (
            await solanaApi.rpcClient
                .getTokenAccountsByOwner(
                    address(owner),
                    {
                        programId: TOKEN_PROGRAM_ID,
                    },
                    {
                        encoding: 'jsonParsed',
                    },
                )
                .send()
        ).value;

        return tokens
            .map(({ account }) => {
                const parsed = account.data.parsed;

                return {
                    mint: parsed.info.mint,
                    amount: parsed.info.tokenAmount.uiAmount,
                };
            })
            .filter(({ amount }) => Boolean(amount));
    }

    async getTokenTopHolders(target: string, size = 100) {
        const tokenHolders = await solanaApi.rpcClient
            .getProgramAccounts(TOKEN_PROGRAM_ID, {
                filters: [
                    {
                        dataSize: 165n,
                    },
                    {
                        memcmp: {
                            offset: 0n,
                            bytes: target,
                            encoding: 'base58',
                        },
                    },
                ],
                encoding: 'jsonParsed',
            })
            .send();

        const holders = [];

        for (const { account, pubkey } of tokenHolders) {
            if (Array.isArray(account.data)) {
                continue;
            }

            // @ts-ignore
            const { mint, tokenAmount, owner } = account.data.parsed.info ?? {};

            if (!mint || !tokenAmount || tokenAmount.uiAmount < 0) {
                continue;
            }

            holders.push({
                ownerAddress: owner,
                balance: tokenAmount.uiAmount,
                address: pubkey,
            });
        }

        return holders.sort((a, b) => b.balance - a.balance).slice(0, size ?? -1);
    }
}

export const solanaApi = new SolanaApi();

const tokens = await solanaApi.getTokenTopHolders('6ogzHhzdrQr9Pgv6hZ2MNze7UrzBMAFyBBWUYp1Fhitx');
console.log(tokens);
