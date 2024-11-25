import fs from 'fs';
import lodash from 'lodash';
import { solanaApi } from '../../shared/solana/api.js';
import { formatUsd, multiplyByZeros, formatDate } from '../../shared/utils.js';
import { CONFIG } from './config.js';
import { ChartTokenData, MappedToJsonTokenInfo } from './types.js';
import { RaydiumTokenInfo } from '../../shared/solana/types.js';
import { createChart as createChart } from './chart.js';

try {
    const start = performance.now();

    const targetTokenInfo = await solanaApi.getTokenInfo(CONFIG.ANALYZING_CA);
    const tokenPriceUsd = await solanaApi.getTokenUsdPrice(CONFIG.ANALYZING_CA);

    const holders = await solanaApi.getTokenTopHolders(CONFIG.ANALYZING_CA, CONFIG.TOP_HOLDERS);

    const holdersWithRawTokens: {
        address: string;
        holdingAmountUsd: string;
        tokens: { address: string; tokenAmount: number }[];
    }[] = [];

    const otherTokensOfHolders = new Set<string>();

    for (const [index, holder] of holders.entries()) {
        const { balance, ownerAddress } = holder;

        const holdingAmountUsd = Number(tokenPriceUsd) * balance;

        if (CONFIG.EXCLUDED_ADDRESSES.has(ownerAddress) || holdingAmountUsd < CONFIG.MIN_HOLDING_USD) {
            console.log('Исключен холдер #', index);
            continue;
        }

        console.log('Анализ холдера #', index);
        const allTokensOfHolder = await solanaApi.getTokensByOwner(ownerAddress);

        holdersWithRawTokens.push({
            address: ownerAddress,
            holdingAmountUsd: formatUsd(holdingAmountUsd),
            tokens: allTokensOfHolder.map(({ mint, amount }) => {
                otherTokensOfHolders.add(mint);

                return {
                    address: mint,
                    tokenAmount: amount ?? 0,
                };
            }),
        });
    }

    const holdingTokensArray = Array.from(otherTokensOfHolders);
    console.log(`У холдеров найдено ${holdingTokensArray.length} уникальных токенов`);

    const holdingTokensPrices: Record<string, string> = {};
    const holdingTokensInfos: RaydiumTokenInfo[] = [];

    for (const [index, tokensChunk] of lodash.chunk(holdingTokensArray, 35).entries()) {
        console.log('Запрос данных за токенами(35) #', index);

        const chunkedPrices = await solanaApi.getTokensUsdPrice(tokensChunk);
        Object.assign(holdingTokensPrices, chunkedPrices);

        const chunkedInfos = await solanaApi.getTokensInfo(tokensChunk);
        holdingTokensInfos.push(...chunkedInfos);
    }

    const holdingTokensInfosMap = holdingTokensInfos.reduce((acc: Record<string, RaydiumTokenInfo>, tokenInfo) => {
        if (tokenInfo) {
            acc[tokenInfo.address] = tokenInfo;
        }
        return acc;
    }, {});

    const tokensCounter: Record<string, number> = {};

    const mappedHoldersWithUsdTokenValues = holdersWithRawTokens.map((holder) => {
        const mappedTokens: MappedToJsonTokenInfo[] = [];

        for (const { address, tokenAmount } of holder.tokens) {
            const tokenInfo = holdingTokensInfosMap[address];
            const price = Number(holdingTokensPrices[address]);
            const holdingAmountUsd = tokenAmount * price;
            const marketCap = multiplyByZeros(tokenInfo?.decimals ?? 0) * price;

            if (
                !tokenInfo ||
                address === CONFIG.ANALYZING_CA ||
                holdingAmountUsd < CONFIG.MIN_HOLDING_USD_OTHER_TOKEN ||
                marketCap < CONFIG.MIN_MARKET_CAP_USD_OTHER_TOKEN
            ) {
                continue;
            }

            if (!tokensCounter[address]) tokensCounter[address] = 0;
            tokensCounter[address] += 1;

            mappedTokens.push({
                address,
                ticker: tokenInfo.symbol,
                holdingAmount: holdingAmountUsd,
                holdingAmountUsd: formatUsd(holdingAmountUsd),
                marketCap,
                marketCapUsd: formatUsd(marketCap),
            });
        }

        return {
            ...holder,
            tokens: mappedTokens,
        };
    });

    const tokenResults: ChartTokenData[] = [];
    for (const address in holdingTokensInfosMap) {
        const tokenInfo = holdingTokensInfosMap[address];
        const count = tokensCounter[address];
        const price = Number(holdingTokensPrices[address]);
        const marketCap = multiplyByZeros(tokenInfo.decimals, price);

        if (!tokenInfo || !price || !count || count < CONFIG.MIN_HOLDERS_COUNT_TO_CHART) {
            continue;
        }

        tokenResults.push({
            address,
            ticker: tokenInfo.symbol,
            count,
            marketCapUsd: formatUsd(marketCap),
        });
    }

    createOutputDirIfNeeded(targetTokenInfo.symbol);

    createJson(
        {
            analyzedToken: {
                ticker: targetTokenInfo.symbol,
                address: targetTokenInfo.address,
            },
            holders: mappedHoldersWithUsdTokenValues,
            tokens: tokenResults,
        },
        `${targetTokenInfo.symbol}/${formatDate()}`,
    );

    createChart(`${targetTokenInfo.symbol}/holders_tokens_${formatDate()}`, tokenResults);

    const end = performance.now();

    console.log(
        `Время выполнения анализа ${CONFIG.TOP_HOLDERS} холдеров ${CONFIG.ANALYZING_CA}: ${(
            (end - start) /
            1000
        ).toFixed(3)} сек.`,
    );
} catch (error) {
    console.log(error);
}

function createOutputDirIfNeeded(name: string) {
    return fs.mkdir(`${CONFIG.RESEARCH_FOLDER}/${name}`, { recursive: true }, (err) => {
        if (err) throw err;
    });
}

function createJson(data: object, fileName: string) {
    return fs.writeFile(`${CONFIG.RESEARCH_FOLDER}/${fileName}` + '.json', JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error('Ошибка при записи файла:', err);
        } else {
            console.log(`Файл ${fileName} успешно создан и заполнен данными!`);
        }
    });
}
