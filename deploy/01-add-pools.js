// FILL WITH REAL DATA

const blocks_per_day = 86400 / 3;
const pfy_per_day = 60000 * 10**9;

const pools = [
    // pfy as reward and as a deposit token at the same time
    // 60k pfy per day
    [Math.ceil(pfy_per_day / blocks_per_day), '0x69083b64988933e8b4783e8302b9bbf90163280e', '0x69083b64988933e8b4783e8302b9bbf90163280e']
]

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployer} = await getNamedAccounts();

    for (const pool of pools) {
        await deployments.execute(
            'PortifyFarm',
            {
                from: deployer,
                log: true
            },
            'add',
            pool[0],
            pool[1],
            pool[2],
            true
        );
    }
};
module.exports.tags = ['pools'];
