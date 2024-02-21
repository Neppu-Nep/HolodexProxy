export default {
    async fetch(request, env, ctx) {

        let headers = new Headers();
        headers.set('Access-Control-Allow-Origin', 'https://holodex.net');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        headers.set('Cache-Control', 'max-age=600');

        if (request.method === "OPTIONS") {
            return new Response("OK", { headers: headers });
        }
        else if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        if (!request.url.includes("api/getChannels")) {
            return new Response("Not found", { status: 404 });
        }

        const postBody = await request.json();
        const YOUTUBE_API_KEY = env.YOUTUBE_API;

        const yTResponse = await check_yT(postBody.ytChannels, YOUTUBE_API_KEY);
        const twitchResponse = await check_twitch(postBody.twitchChannels);

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
        let api_url = `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=7&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}`;
        const response = await fetch(api_url);
        const data = await response.json();

        for (const item of data.items) {
            videoIds.push(item.snippet.resourceId.videoId);
        }
    }));

    if (videoIds.length == 0) {
        return finalResponse;
    }

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
            available_at: item.liveStreamingDetails.scheduledStartTime,
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
            id: item.id,
            title: item.snippet.title,
            type: "stream",
            published_at: item.snippet.publishedAt,
            available_at: item.liveStreamingDetails.scheduledStartTime,
            duration: 0,
            status: "upcoming",
            start_scheduled: item.liveStreamingDetails.scheduledStartTime,
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

        let thumb_url = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelId}-1920x1080.jpg`;

        if (data.includes("isLiveBroadcast")) {

            const thumb_data = await fetch(thumb_url);
            if (thumb_data.redirected) {
                return;
            }

            let firstPart = data.substring(data.indexOf('<script type="application/ld+json">') + 35);
            let parsedData = JSON.parse(firstPart.substring(0, firstPart.indexOf("</script>")))[0];
            finalResponse.push({
                id: "1234",
                title: parsedData.description,
                type: "placeholder",
                available_at: parsedData.publication.startDate,
                duration: 0,
                status: "live",
                start_scheduled: parsedData.publication.startDate,
                start_actual: parsedData.publication.startDate,
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
                thumbnail: thumb_url,
                placeholderType: "external-stream",
            });
        }
    }));
    return finalResponse;
}