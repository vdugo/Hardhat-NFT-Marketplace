const { deployments, ethers, network } = require('hardhat')
const { assert, expect } = require('chai')
const { developmentChains } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name) ? describe.skip
:
describe("NftMarketplace Unit Tests", async () =>
{
    let nftMarketplace, basicNft, deployer, user

    const PRICE = ethers.utils.parseEther("0.1")

    const INSUFFICIENT_PRICE = ethers.utils.parseEther("0.05")

    const NEW_PRICE = ethers.utils.parseEther("0.2")

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

        it("updates the listings mapping when an item is cancelled", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

            await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)

            const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)

            assert(listing.price.toString() === '0', 'listing.price !== 0')
            assert(listing.seller.startsWith('0x'), 'listing.seller does not start with "0x"')

        })
    })

    describe("buyItem", async () =>
    {
        it("makes sure the NFT is listed before it can be bought", async () =>
        {
            await expect(nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE})).to.be.reverted
        })

        it("reverts if the sale price of the NFT is not met", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

            await expect(nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: INSUFFICIENT_PRICE})).to.be.reverted
        })

        it("updates the proceeds mapping such that the seller balance increases by the sale price of the NFT", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
            await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE})

            const sellerProceeds = await nftMarketplace.getProceeds(deployer.address)

            assert(sellerProceeds.toString() === PRICE.toString(), 'sellerProceeds.toString() !== PRICE.toString()')
        })

        it("deletes the listing for that NFT after the sale is complete", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
            await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE})

            const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)

            assert(listing.price.toString() === '0', 'listing.price !== 0')
            assert(listing.seller.startsWith('0x'), 'listing.seller does not start with "0x"')
        })

        it("transfers ownership of the NFT to the buyer", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

            nftMarketplace = nftMarketplaceContract.connect(user)

            await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE})

            const newOwner = await basicNft.ownerOf(TOKEN_ID)

            assert(newOwner.toString() === user.address, 'newOwner.toString() !== user.address')
        })

        it("emits an ItemBought event on sale of the NFT", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
            expect(await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE})).to.emit("ItemBought")
        })
    })

    describe("updateListing", async () =>
    {
        it("reverts if attempting to update a listing that does not exist", async () =>
        {
            await expect(nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEW_PRICE)).to.be.reverted
        })

        it("only allows the owner to update the listing", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

            nftMarketplace = nftMarketplaceContract.connect(user)

            await expect(nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEW_PRICE)).to.be.reverted
        })

        it("updates the listing in the listings mapping to reflect the updated price", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
            nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEW_PRICE)

            const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)

            assert(listing.price.toString() === NEW_PRICE.toString())
        })

        it("emits an ItemListed event when an item is updated", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
            expect(await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEW_PRICE)).to.emit("ItemListed")
        })
    })

    describe("withdrawProceeds", async () =>
    {
        it("reverts if the seller's proceeds are <= 0", async () =>
        {
            await expect(nftMarketplace.withdrawProceeds()).to.be.reverted
        })

        it("resets the proceeds mapping to 0 for the seller after they withdraw", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
            await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE})
            await nftMarketplace.withdrawProceeds()

            const sellerProceeds = await nftMarketplace.getProceeds(deployer.address)

            assert(sellerProceeds.toString() === '0', 'sellerProceeds.toString() !== "0"')
        })

        it("sends the proceeds to the seller's address upon withdrawal", async () =>
        {
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

            nftMarketplace = nftMarketplaceContract.connect(user)
            await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE})

            nftMarketplace = nftMarketplaceContract.connect(deployer)

            const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer.address)
            const deployerBalanceBefore = await deployer.getBalance()

            const txResponse = await nftMarketplace.withdrawProceeds()
            const txReceipt = await txResponse.wait(1)

            const { gasUsed, effectiveGasPrice } = txReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const deployerBalanceAfter = await deployer.getBalance()

            assert(deployerBalanceAfter.add(gasCost).toString() === deployerProceedsBefore.add(deployerBalanceBefore).toString())
        })
    })

})