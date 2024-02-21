// ==UserScript==
// @name         Custom Holodex Proxy
// @version      2024-02-20
// @description  Proxy for Holodex to add user-specified channels from youtube and twitch
// @author       Nep
// @match        https://holodex.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=holodex.net
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    const proxyUrl = "https://proxy.temp.sample";
    const ChannelInfos = {
        "BriAtCookiebox": {
            "id": "UC1uzMZ7x_Hgun5t8J9uFanw",
            "thumbnail": "https://yt3.googleusercontent.com/ytc/AIf8zZQiDJ8ifPuPnoodU02w9BOEoVp1oDWI26ElSLY0=s176-c-k-c0x00ffffff-no-rj",
            "platform": "youtube"
        },
        "HexaVT": {
            "id": "hexavt",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/28bf2400-367f-4fc9-a1b4-cb178d651ad5-profile_image-70x70.png",
            "platform": "twitch"
        },
        "Nanobites": {
            "id": "nanobites",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/491954e0-2aab-40ed-b3d9-f9930609d327-profile_image-70x70.png",
            "platform": "twitch"
        },
        "UWO's Lab": {
            "id": "uwoslab",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/ba4a5f71-f6f9-4aba-8572-605dbd551f34-profile_image-70x70.png",
            "platform": "twitch"
        }
    };

    let postBody = {
        ytChannels: [],
        twitchChannels: []
    };

    for (let key in ChannelInfos) {
        if (ChannelInfos[key].platform === "youtube") {
            postBody.ytChannels.push(ChannelInfos[key].id);
        } else if (ChannelInfos[key].platform === "twitch") {
            postBody.twitchChannels.push([ChannelInfos[key].id, key]);
        }
    }
    const requestUrl = `${proxyUrl}/api/getChannels`;

    let oldXHROpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (url.toString().includes("holodex.net/api/v2/users/live")) {
            this.addEventListener("readystatechange", function() {
                if (this.readyState === 4) {
                    let oldResponse = JSON.parse(this.responseText);
                    Object.defineProperty(this, 'response', {writable: true});
                    Object.defineProperty(this, 'responseText', {writable: true});
                    let request = new XMLHttpRequest();
                    request.open("POST", requestUrl, false);
                    request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                    request.send(JSON.stringify(postBody));
                    let response = JSON.parse(request.responseText);
                    let finalResponse = oldResponse.concat(response);
                    this.response = this.responseText = JSON.stringify(finalResponse);
                }
            });
        }
        return oldXHROpen.apply(this, arguments);
    }

    function attachThumbWatcher() {
        let domElement = document.getElementsByClassName("videos-bar")[0];
        if (!domElement) {
            window.setTimeout(attachThumbWatcher, 500);
            return;
        }

        let Observer = new window.MutationObserver((e) => {
            let children = domElement.children;
            for (let i = 0; i < children.length; i++) {
                let img = children[i].getElementsByTagName("img")[0];
                if (!img) {
                    continue;
                }
                for (let key in ChannelInfos) {
                    if (img.src.includes(ChannelInfos[key].id)) {
                        img.src = ChannelInfos[key].thumbnail;
                        break;
                    }
                }
            }
        });
        Observer.observe(domElement, {
            childList: true
        });
    }
    attachThumbWatcher();

})();