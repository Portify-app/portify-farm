
// 2nd jan 2022
const START_BLOCK = 14013041;

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployer} = await getNamedAccounts();

    await deployments.deploy('PortifyFarm', {
        from: deployer,
        log: true,
        args: [START_BLOCK]
    });
};
module.exports.tags = ['farm'];
