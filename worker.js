export default {
    async fetch(request, env, ctx) {

        let headers = new Headers();
        headers.set('Access-Control-Allow-Origin', 'https://holodex.net');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        headers.set('Cache-Control', 'max-age=900');
  
        if (!request.url.includes("api/v2/users/live")) {
            return new Response("Not found", { status: 404 });
        }
  
        const YOUTUBE_API_KEY = env.YOUTUBE_API;
        let YTChannels = [
            "UC1uzMZ7x_Hgun5t8J9uFanw", // BriAtCookiebox
        ];

        let TwitchChannels = [
            // ["channelId", "channelName"]
            ["hexavt", "HexaVT"],
            ["nanobites", "Nanobites"],
            ["uwoslab", "UWO's Lab"],
        ];
  
        let yTResponse = await check_yT(YTChannels, YOUTUBE_API_KEY);
        let twitchResponse = await check_twitch(TwitchChannels);
  
        let finalResponse = [];
        finalResponse = finalResponse.concat(yTResponse);
        finalResponse = finalResponse.concat(twitchResponse);

        return new Response(JSON.stringify(finalResponse), { headers: headers });
    }
  };
  
async function check_yT(channelIds, YOUTUBE_API_KEY) {
  
    let LiveJSONResponse = [];
    let UpcomingJSONResponse = [];
    let finalResponse = [];

    let videoIds = [];
  
    await Promise.all(channelIds.map(async (channelId) => {
        let playlistId = "UULV" + channelId.substring(2);
        let api_url = `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}`;
        const response = await fetch(api_url);
        const data = await response.json();

        for (const item of data.items) {
            videoIds.push(item.snippet.resourceId.videoId);
        }
    }));

    let videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&maxResults=50&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`;
    const videoResponse = await fetch(videoUrl);
    const videoData = await videoResponse.json();

    for (const item of videoData.items) {
        if (item.snippet.liveBroadcastContent === "live") {
            LiveJSONResponse.push(item);
        }
        else if (item.snippet.liveBroadcastContent === "upcoming") {
            UpcomingJSONResponse.push(item);
        }
    }
  
    for (const item of LiveJSONResponse) {
        let result = {
            id: item.id,
            title: item.snippet.title,
            type: "stream",
            published_at: item.snippet.publishedAt,
            available_at: item.snippet.publishedAt,
            duration: 0,
            status: "live",
            start_scheduled: item.liveStreamingDetails.scheduledStartTime,
            start_actual: item.liveStreamingDetails.actualStartTime,
            live_viewers: item.liveStreamingDetails.concurrentViewers,
            channel: {
                id: item.snippet.channelId,
                name: item.snippet.channelTitle,
                org: "Independents",
                suborg: "",
                type: "vtuber",
                photo: "",
                english_name: item.snippet.channelTitle,
            }
        };
        finalResponse.push(result);
    }
  
    for (const item of UpcomingJSONResponse) {
        let result = {
            id: item.id.videoId,
            title: item.snippet.title,
            type: "stream",
            published_at: item.snippet.publishedAt,
            available_at: item.snippet.publishedAt,
            duration: 0,
            status: "upcoming",
            start_scheduled: item.snippet.publishedAt,
            live_viewers: 0,
            channel: {
                id: item.snippet.channelId,
                name: item.snippet.channelTitle,
                org: "Independents",
                suborg: "",
                type: "vtuber",
                photo: "",
                english_name: item.snippet.channelTitle,
            }
        };
        finalResponse.push(result);
    }
  
    return finalResponse;
}
  
async function check_twitch(channelIds) {
    let finalResponse = [];
    await Promise.all(channelIds.map(async ([channelId, channelName]) => {
        const twitch_url = `https://twitch.tv/${channelId}`;
        const response = await fetch(twitch_url);
        const data = await response.text();

        if (data.includes("isLiveBroadcast")) {
            finalResponse.push({
                id: "1234",
                title: channelName,
                type: "placeholder",
                available_at: new Date().toISOString(),
                duration: 0,
                status: "live",
                start_scheduled: new Date().toISOString(),
                start_actual: new Date().toISOString(),
                channel: {
                    id: channelId,
                    name: channelName,
                    org: "Independents",
                    suborg: "",
                    type: "vtuber",
                    photo: "",
                    english_name: channelName,
                },
                link: `https://twitch.tv/${channelId}`,
                certainty: "certain",
                thumbnail: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelId}-1920x1080.jpg`,
                placeholderType: "external-stream",
            });
        }
    }));
    return finalResponse;
}