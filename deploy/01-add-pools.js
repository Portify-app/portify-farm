// FILL WITH REAL DATA
const pools = [
    (1000, '0x67A6E4e876961d4E1AacE8A51391615a1818D01c', '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4'),
    (2000, '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4', '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2')
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
