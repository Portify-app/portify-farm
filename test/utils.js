function evmMine () {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: new Date().getTime()
        }, (error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

function evmIncreaseTime(seconds) {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            method: "evm_increaseTime",
            params: [seconds],
            jsonrpc: "2.0",
            id: new Date().getTime()
        }, (error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

module.exports = {
    evmIncreaseTime,
    evmMine
};