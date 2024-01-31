const axios = require('axios');

async function register ({
  registerHook,
  registerSetting,
  settingsManager,
  storageManager,
  peertubeHelpers,
  getRouter,
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager
}) {
    const fs = require('fs');
    registerSetting({
    name: 'debug-enable',
    default: false,
    label: 'Enable diagnostic log updates',
    type: 'input-checkbox',
    descriptionHTML: 'This will create more extensive logging of program state data both client and server side for finding and resolving errors ',
    private: false
  })
  let enableDebug = await settingsManager.getSetting("debug-enable");
  var base = await peertubeHelpers.config.getWebserverUrl();
  var basePath = peertubeHelpers.plugin.getDataDirectoryPath();
  var serverConfig = await peertubeHelpers.config.getServerConfig();
  var plugins = serverConfig.plugin.registered;
  var hostName = serverConfig.instance.name;
  let hostParts= base.split('//');
  let hostDomain = hostParts.pop();
  if (enableDebug) {
    console.log("⚓⚓ torrent rss server settings loaded", hostName, hostDomain, base, basePath);
    console.log("⚓⚓ continued", plugins, serverConfig);
  }
  
  const router = getRouter();
  router.use('/rss', async (req,res) =>{
    res.setHeader('content-type', 'application/rss+xml');
    if (enableDebug) {
      console.log("⚓⚓⚓⚓ torrent feed request",req.query);
    }
    let channel
    let account;
    let playlist;
    let channelData;
    let accountData;
    let playlistData;
    let videoList;
    let displayName;
    let description;
    let url;
    let atomLink;
    let rssData;
    let rssFile;
    if (req.query.account == undefined) {
      if (enableDebug) {
        console.log("⚓⚓ no account requested", req.query);
      }
    } else {
      account = req.query.account;
      const cache = await storageManager.getData(`btrss-${account}`)
      let timeDiff;
      if (cache){
        timeDiff=Date.now()-cache;
        console.log ("⚓⚓ cache timediffs", timeDiff,timeDiff/1000,timeDiff/60000,timeDiff/3600000);
      }
      rssFile = basePath+"/"+account+".rss";
      try {
        await fs.readFile(rssFile, 'utf8',(err, rssData) => {
          if (timeDiff/60000<2){          
            return  res.status(200).send(rssData);
          }
        })
      } catch (error) {
        console.error(`Got an error trying to read the file: ${error.message}`,error);
      }  
     
      if (rssData){
        console.log(`⚓⚓ got rss data:`,rssData);
        return  res.status(200).send(rssData);
      }
      
      accountData = await getAccount(account);
      if (accountData){
        description = accountData.description;
        url = accountData.url;
        displayName = accountData.displayName;
        atomLink = `${base}/plugins/btrss/router/rss?account="${account}"`;
        if (enableDebug) {
          console.log("⚓⚓⚓⚓ account data",accountData,displayName,url,description,atomLink);
        }
        videoList = await getAccountVideos(account);
      }
    }
    if (enableDebug) {
      //console.log("⚓⚓⚓⚓ video list", videoList);
    }
    if (req.query.channel == undefined) {
      if (enableDebug) {
        console.log("⚓⚓ no channel requested", req.query);
      }
    } else {
      channel = req.query.channel;
      channelData = await getChannel(channel);
      if (channelData){
        description = channelData.description;
        url = channelData.url;
        displayName = channelData.displayName;
        atomLink = `${base}/plugins/btrss/router/rss?channel="${channel}"`;
        if (enableDebug) {
          console.log("⚓⚓⚓⚓ channel data",channelData,displayName,url,description,atomLink);
        }
        videoList = await getChannelVideos(channel);
      }
    }
    if (enableDebug && videoList) {
      console.log("⚓⚓⚓⚓ video list", videoList.length);
    }
    let rss = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`;
    let indent =4;
    rss = rss +"\n"+' '.repeat(indent)+`<channel>`;
    indent = indent+4;
    rss = rss + `\n`+' '.repeat(indent)+`<title>${displayName.replace(/\W+/g, " ")}</title>`;
    rss = rss + `\n`+' '.repeat(indent)+`<link>${url}</link>`;
    if (description){
      rss = rss + `\n`+' '.repeat(indent)+`<description> ${description.replace(/\W+/g, " ")} </description>`;
    } else {
      rss = rss + `\n`+' '.repeat(indent)+`<description> indescribable </description>`;
    }
    //let atomLink = base + "/plugins/podcast2/router/torrent?channel=" + channel;
    rss = rss + `\n`+' '.repeat(indent)+`<atom:link href="${atomLink}" rel="self" type="application/rss+xml" />`;
    for (var video of videoList){
      rss = rss + `\n`+' '.repeat(indent)+`<item>`;
      indent = indent + 4;
      rss = rss + `\n`+' '.repeat(indent)+`<title>${video.name.replace(/\W+/g, " ")}</title>`;
      
      if (video.description){
        rss = rss + `\n`+' '.repeat(indent)+`<description>`;
        indent=indent+4;
        rss = rss + `\n`+' '.repeat(indent)+`${video.description.replace(/\W+/g, " ")}`;
        indent=indent-4;
        rss = rss + `\n`+' '.repeat(indent)+`</description>`;
      } else {
        rss = rss + `\n`+' '.repeat(indent)+`<description/>`;
      }
      
      let apiUrl = `${base}/api/v1/videos/${video.uuid}`;
      let videoSpecificData;
      let torrentUrl, fileSize, magnet, tracker, pubDate,rawDate;
      try {
        videoSpecificData = await axios.get(apiUrl);
      } catch (err) {
        console.log("⚓⚓⚓⚓unable to load video specific info", apiUrl,err);
        return res.status(400).send();
      }
     
      torrentUrl = videoSpecificData.data.streamingPlaylists[0].files[0].torrentUrl;
      fileSize =   videoSpecificData.data.streamingPlaylists[0].files[0].size;
      magnet = videoSpecificData.data.streamingPlaylists[0].files[0].magnetUri;
      tracker = videoSpecificData.data.trackerUrls[0];
      //console.log("⚓⚓⚓⚓ published", pubDate);
      let fileName = video.name;
      //console.log("⚓⚓⚓⚓ found file name", fileName);
      rss = rss + `\n`+' '.repeat(indent)+`<enclosure type="application/x-bittorrent" url="${torrentUrl}" length="${fileSize}" />`;
      rss = rss + `\n`+' '.repeat(indent)+`<link>${torrentUrl}</link>`;
      rss = rss + `\n`+' '.repeat(indent)+`<guid>${torrentUrl}</guid>`;
      //rss = rss + `\n`+' '.repeat(indent)+`<media:content url="${torrentUrl}" fileSize="${fileSize}" />`;
      if (videoSpecificData.data.originallyPublishedAt){
        rawDate = videoSpecificData.data.originallyPublishedAt;
      } else {
        rawDate = videoSpecificData.data.publishedAt;
      }
        let newDate = new Date(rawDate);
      pubDate = newDate.toUTCString();

      console.log("⚓⚓⚓⚓ published", rawDate, "new format",newDate, "final format",pubDate);
      rss = rss + `\n`+' '.repeat(indent)+`<pubDate> ${pubDate} </pubDate>`;
      
      /*
      rss = rss + `\n`+' '.repeat(indent)+`<torrent>`;
      indent=indent +4;
      rss = rss + `\n`+' '.repeat(indent)+`<filename> ${fileName} </filename>`;
      rss = rss + `\n`+' '.repeat(indent)+`<contentlength> ${fileSize} </contentlength>`;
      rss = rss + `\n`+' '.repeat(indent)+`<magneturi> ${magnet} <magneturi>`;
      rss = rss + `\n`+' '.repeat(indent)+`<trackers>`;
      indent = indent +4;
      rss = rss + `\n`+' '.repeat(indent)+`<group order="ordered">`;
      indent = indent+4;
      rss = rss + `\n`+' '.repeat(indent)+`<tracker seeds="1" peers="1">`;
      indent = indent + 4;
      rss = rss + `\n`+' '.repeat(indent)+tracker;
      indent = indent - 4
      rss = rss + `\n`+' '.repeat(indent)+`</tracker>`;
      indent = indent -4;
      rss = rss + `\n`+' '.repeat(indent)+`</group>`;
      indent = indent - 4
      rss = rss + `\n`+' '.repeat(indent)+`</trackers>`;
      indent = indent -4;
      rss = rss + `\n`+' '.repeat(indent)+`</torrent>`;
      */
      indent = indent -4;
      
      rss = rss + `\n`+' '.repeat(indent)+`</item>`;
    }
    indent = indent-4;
    rss = rss + `\n`+' '.repeat(indent)+`</channel>`;
    rss = rss + `\n</rss>\n`;
    if (rss == rssData){
      console.log("⚓⚓ cached data matches fresh data", rssFile,err);
    } else if (rssFile){
      fs.writeFile(rssFile, rss, (err) => {
        console.log("⚓⚓⚓⚓ unable to write rss file", rssFile,err);
      });
    }
    if (account) {
      storageManager.storeData(`btrss-${account}`,Date.now());
    }
    if (channel) {
      storageManager.storeData(`btrss-${channel}`,Date.now());
    }
    return  res.status(200).send(rss);
  })
  async function getChannel(channel){
    let apiUrl = base + "/api/v1/video-channels/" + channel;
    let channelData;
    try {
      channelData = await axios.get(apiUrl);
    } catch (err) {
      if (enableDebug) {
        console.log("⚓⚓⚓⚓unable to load channel info", apiUrl,err);
      }
      return;
    }
    if (enableDebug) {
      console.log("⚓⚓⚓⚓ channel Data",channelData.data);
    }
    return channelData.data
  }
  async function getAccount(account){ 
    let apiUrl = `${base}/api/v1/accounts/${account}`;
    let accountData;
    try {
      accountData = await axios.get(apiUrl);
    } catch (err) {
      if (enableDebug) {
        console.log("⚓⚓⚓⚓ unable to load account info", apiUrl,err);
      }
      return;
    }
    if (enableDebug) {
      console.log("⚓⚓⚓⚓ account Data",accountData.data);
    }
    return accountData.data
  }
  async function getPlaylist(account){ 
    let apiUrl = `${base}/api/v1/accounts/${account}`;
    let accountData;
    try {
      accountData = await axios.get(apiUrl);
    } catch (err) {
      if (enableDebug) {
        console.log("⚓⚓⚓⚓ unable to load account info", apiUrl,err);
      }
      return;
    }
    if (enableDebug) {
      console.log("⚓⚓⚓⚓ account Data",accountData.data);
    }
    return accountData.data
  }
  async function getChannelVideos (channel){
    let apiUrl = `${base}/api/v1/video-channels/${channel}/videos`;
    let videoData;
    try {
      videoData = await axios.get(apiUrl);
    } catch (err) {
      console.log("⚓⚓⚓⚓unable to load channel video info", apiUrl,err);
      return;
    }
    if (enableDebug) {
      //console.log("⚓⚓⚓⚓ channel video Data",videoData.data.total,videoData.data.data);
    }
    return videoData.data.data;
  }
  async function getAccountVideos (account){
    let apiUrl = `${base}/api/v1/accounts/${account}/videos`;
    let videoData;
    try {
      videoData = await axios.get(apiUrl);
    } catch (err) {
      console.log("⚓⚓⚓⚓unable to load account video info", apiUrl,err);
      return;
    }
    if (enableDebug) {
      //console.log("⚓⚓⚓⚓ channel video Data",videoData.data.total,videoData.data.data);
    }
    return videoData.data.data;
  }
}
async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}
