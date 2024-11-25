export const sleep = (number = 1000) => new Promise((resolve) => setTimeout(resolve, number));

export function multiplyByZeros(zerosCount: number, targetNumber: number = 1) {
    return targetNumber * Math.pow(10, zerosCount);
}

export function formatDate(date: Date = new Date()) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    return `${day}.${month}.${year}`;
}
export function formatUsd(amount: number) {
    return amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

