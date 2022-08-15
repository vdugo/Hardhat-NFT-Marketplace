const { deployments, ethers, network } = require('hardhat')
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
        const accounts = await ethers.getSigners()
        deployer = accounts[0]
        user = accounts[1]
        
        await deployments.fixture(["all"])

        nftMarketplaceContract = await ethers.getContract("NftMarketplace")
        nftMarketplace = nftMarketplaceContract.connect(deployer)

        basicNftContract = await ethers.getContract("BasicNft")
        basicNft = basicNftContract.connect(deployer)

        await basicNft.mintNft()
        await basicNft.approve(nftMarketplaceContract.address, TOKEN_ID)
        
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

            assert(listing.price.toString() === PRICE.toString(), "listing.price !== PRICE")
            assert(listing.seller.toString() === deployer.address.toString(), 'listing.seller !== deployer')
        })

    })

    describe("cancelListing", async () =>
    {
        it("reverts if there is no listing for that NFT", async () =>
        {
            await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.be.reverted
        })

        it("emits an event after cancelling an item", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

            expect(await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit("ItemCanceled")
        })

        it("only allows the owner of the NFT to cancel the listing", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

            nftMarketplace = nftMarketplaceContract.connect(user)

            await basicNft.approve(user.address, TOKEN_ID)

            await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.be.reverted
        })
    })

})