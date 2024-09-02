require('dotenv').config()
const { composeDetails } = require("./compose-details")

const API_KEY = process.env.YOUTUBE_API_KEY
const getYoutubeId = (url) => {
  const urlObj = new URL(url)

  if (
    urlObj.hostname === "youtube.com" ||
    urlObj.hostname === "www.youtube.com"
  ) {
    return urlObj.searchParams.get("v")
  }

  if (urlObj.hostname === "youtu.be") {
    return urlObj.pathname.split("/").pop()
  }
}

const composeDetailsYoutube = async (url) => {
  console.log("composeDetailsYoutube")
  const youtubeID = getYoutubeId(url)
  console.log('youtubeID', youtubeID)
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${youtubeID}&key=${API_KEY}&part=snippet,contentDetails,statistics,status`

  console.log("fetching api", apiUrl)
  return fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      console.log("youtube data", data.items[0].snippet.thumbnails)
      const icon =
        data.items[0].snippet.thumbnails.maxres?.url ||
        data.items[0].snippet.thumbnails.high?.url ||
        data.items[0].snippet.thumbnails.standard?.url
      const params = {
        description: data.items[0].snippet.description,
        icon: icon,
      }
      return composeDetails(params)
    })
}

module.exports = {
  composeDetailsYoutube,
}
