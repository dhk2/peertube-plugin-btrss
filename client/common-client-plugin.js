//import axios from 'axios';
//const axios = require("axios");
async function register({ registerHook, peertubeHelpers, registerVideoField, registerClientRoute }) {
  const { notifier } = peertubeHelpers
  const basePath = await peertubeHelpers.getBaseRouterRoute();
  console.log(" torrent rss client loaded",basePath);
}
  export {
  register
}

