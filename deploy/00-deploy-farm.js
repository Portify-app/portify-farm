
const START_BLOCK = 999999;

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployer} = await getNamedAccounts();

    await deployments.deploy('PortifyFarm', {
        from: deployer,
        log: true,
        args: [START_BLOCK]
    });
};
module.exports.tags = ['farm'];
