const { deployments, ethers, network, getNamedAccounts } = require('hardhat')
const { assert, expect } = require('chai')
const { developmentChains } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name) ? describe.skip
:
describe("NftMarketplace Unit Tests", async () =>
{
    let nftMarketplace, basicNft, deployer, user

    const PRICE = ethers.utils.parseEther("0.1")

    const TOKEN_ID = 0

    beforeEach(async () =>
    {
        deployer = (await getNamedAccounts()).deployer
        const accounts = await ethers.getSigners()
        user = accounts[1]
        
        await deployments.fixture(["all"])

        nftMarketplace = await ethers.getContract("NftMarketplace", deployer)

        basicNft = await ethers.getContract("BasicNft", deployer)

        await basicNft.mintNft()
        await basicNft.approve(nftMarketplace.address, TOKEN_ID)
        
    })

    describe("listItem", async () =>
    {
        it("emits an event after listing an item", async () =>
        {
            expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit("ItemListed")
        })

        it("does not allow an item to be listed if it's already listed", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

            await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.be.reverted
        })

        it("does not allow an item to be listed for 0 or less", async () =>
        {
            await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, 0)).to.be.reverted
        })

        it("needs approval for an item to be listed", async () =>
        {
            // approve the nft for an address that is not the marketplace so that
            // the marketplace no longer has approval
            await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
            await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.be.reverted
        })

        it("updates the listings mapping when an item is listed", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
            const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)

            assert(listing.price.toString() === PRICE.toString())
            assert(listing.seller.toString() === deployer.toString())
        })

    })

})