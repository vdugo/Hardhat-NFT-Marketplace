const { deployments, ethers, network } = require('hardhat')
const { assert, expect } = require('chai')
const { developmentChains } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name) ? describe.skip
:
describe("NftMarketplace Unit Tests", async () =>
{
    
})