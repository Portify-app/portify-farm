const MAX_BOOST = 2000;

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployer} = await getNamedAccounts();

    await deployments.execute(
        'PortifyFarm',
        {
            from: deployer,
            log: true
        },
        'setMaxBoost',
        MAX_BOOST // 2x boost
    );
};
module.exports.tags = ['boost'];
