// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract NftMarketplace
{
    struct Listing
    {
        uint256 price;
        address seller;
    }

    event ItemListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 price);

    event ItemBought(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 price);

    // NFT contract address -> NFT token id -> Listing
    mapping(address => mapping(uint256 => Listing)) private s_listings;

    // seller address -> amount earned
    mapping(address => uint256) private s_proceeds;

    modifier notListed(address nftAddress, uint256 tokenId, address owner)
    {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price > 0)
        {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }

        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId)
    {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price <= 0)
        {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }

        _;
    }

    modifier isOwner(address nftAddress, uint256 tokenId, address spender)
    {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);

        if (spender != owner)
        {
            revert NftMarketplace__NotOwner();
        }

        _;
    }

    /**
     * @dev If we had the contract be the escrow, it would be a lot more gas expensive.
     * @param nftAddress The address of the NFT
     * @param tokenId The token id of the NFT
     * @param price The sale price of the NFT
     */
    function listItem(
        address nftAddress, 
        uint256 tokenId, 
        uint256 price) 
        external
        notListed(nftAddress, tokenId, msg.sender)
    {
        if (price <= 0)
        {
            revert NftMarketplace__PriceMustBeAboveZero();
        }

        IERC721 nft = IERC721(nftAddress);

        if (nft.getApproved(tokenId) != address(this))
        {
            revert NftMarketplace__NotApprovedForMarketplace();
        }
        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function buyItem(address nftAddress, uint256 tokenId) 
    external 
    payable
    isListed(nftAddress, tokenId)
    {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if (msg.value < listedItem.price)
        {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listedItem.price);
        }
        // we don't want to just send the seller the money
        // we want to have them withdraw the money
        // this shifts the risk of working with money to the user
        s_proceeds[listedItem.seller] += msg.value;
        delete s_listings[nftAddress][tokenId];
        IERC721(nftAddress).safeTransferFrom(listedItem.seller, msg.sender, tokenId);

        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
    }
}