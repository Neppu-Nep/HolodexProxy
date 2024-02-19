// ==UserScript==
// @name         Nep's Holodex Proxy
// @version      2024-02-15
// @description  Proxy for Holodex to add custom vtubers from youtube and twitch
// @author       Nep
// @match        https://holodex.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=holodex.net
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    const proxyUrl = "proxy.temp.sample";
    const THUMBNAIL_MAP = {
        "UC1uzMZ7x_Hgun5t8J9uFanw": "https://yt3.googleusercontent.com/ytc/AIf8zZQiDJ8ifPuPnoodU02w9BOEoVp1oDWI26ElSLY0=s176-c-k-c0x00ffffff-no-rj",
        "hexavt": "https://static-cdn.jtvnw.net/jtv_user_pictures/28bf2400-367f-4fc9-a1b4-cb178d651ad5-profile_image-70x70.png",
        "nanobites": "https://static-cdn.jtvnw.net/jtv_user_pictures/491954e0-2aab-40ed-b3d9-f9930609d327-profile_image-70x70.png",
        "uwoslab": "https://static-cdn.jtvnw.net/jtv_user_pictures/ba4a5f71-f6f9-4aba-8572-605dbd551f34-profile_image-70x70.png",
    };

    let oldXHROpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (url.toString().includes("holodex.net/api/v2/users/live")) {
            this.addEventListener("readystatechange", function() {
                if (this.readyState === 4) {
                    let oldResponse = JSON.parse(this.responseText);
                    Object.defineProperty(this, 'response', {writable: true});
                    Object.defineProperty(this, 'responseText', {writable: true});
                    let newUrl = url.toString().replace("holodex.net", proxyUrl);
                    let request = new XMLHttpRequest();
                    request.open("GET", newUrl, false);
                    request.send();
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
                for (let key in THUMBNAIL_MAP) {
                    if (img.src.includes(key)) {
                        img.src = THUMBNAIL_MAP[key];
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