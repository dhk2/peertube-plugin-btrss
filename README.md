This is for regular Torrenting, not WebTorrents. This makes the p2p completely seperate from the p2p in the browser at this time.

Currently this is primarily useful for automated Torrenting of PeerTube Channels/Accounts as a seperate complementary distribution mechanism which can more easily be utilized by apps and seedboxes.

For channels:
(peertube instance url)/plugins/btrss/router/rss?channel=(channel name)
For Accounts:
(peertube instance url)/plugins/btrss/router/rss?account=(account name)

Add the RSS feed to a Torrent Client that supports RSS downloads and it should work, please open an issue if you find a client that it doesn't work with. A sample RSS feed that is known to work with that client would be a big help in determining how to fix the compatibility