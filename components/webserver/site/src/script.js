const AttackStateEnum = { READY: 0, RUNNING: 1, FINISHED: 2, TIMEOUT: 3 };
const AttackTypeEnum = { ATTACK_TYPE_PASSIVE: 0, ATTACK_TYPE_HANDSHAKE: 1, ATTACK_TYPE_PMKID: 2, ATTACK_TYPE_DOS: 3 };
const RUNNING_POLL_INTERVAL = 1000;
const POLL_INTERVAL = 1000;
const ESP_URL = "http://192.168.4.1"

var selectedApElement = null;
var poll;
var runningPoll;
var attackTimeout = 0;
var timeElapsed = 0;
var defaultResultContent = $("results").innerHTML;
var defaultAttackMethods = $("attack_method").outerHTML;

function $(id) {
    return document.getElementById(id)
}

function updateError(text) {
    if (text) {
        $('errors').innerText = text;
        $('errors').classList.remove("hidden");
        $('errors').classList.add("visible");
    } else {
        $('errors').classList.add("hidden");
        $('errors').classList.remove("visible");
    }
}

function showSection(sectionId) {
    if ($(sectionId).classList.contains("hidden")) {
        for (let section of document.getElementsByTagName("section")) {
            section.classList.remove("visible");
            section.classList.add("hidden");
        };
        $(sectionId).classList.remove("hidden");
        $(sectionId).classList.add("visible");
    }
}

function getStatus() {
    updateError(null);
    var statusRequest = new XMLHttpRequest();
    statusRequest.onload = function () {
        var arrayBuffer = statusRequest.response;
        if (arrayBuffer) {
            var attackState = parseInt(new Uint8Array(arrayBuffer, 0, 1));
            var attackType = parseInt(new Uint8Array(arrayBuffer, 1, 1));
            var attackContentSize = parseInt(new Uint16Array(arrayBuffer, 2, 1));
            var attackContent = new Uint8Array(arrayBuffer, 4);
            console.log("attack_state=" + attackState + "; attack_type=" + attackType + "; attack_count_size=" + attackContentSize);
            switch (attackState) {
                case AttackStateEnum.READY:
                    fetchAps();
                    showSection("setup");
                    break;
                case AttackStateEnum.RUNNING:
                    showSection("running")
                    setTimeout(getStatus, RUNNING_POLL_INTERVAL);
                    break;
                case AttackStateEnum.FINISHED:
                    showResult("FINISHED", attackType, attackContentSize, attackContent);
                    showSection("results")
                    break;
                case AttackStateEnum.TIMEOUT:
                    showResult("TIMEOUT", attackType, attackContentSize, attackContent);
                    showSection("results")
                    break;
                default:
                    $("errors").innerHTML = "Error loading attack status! Unknown state.";
            }
            return;
        }
    };
    statusRequest.onerror = function () {
        updateError("Cannot reach ESP32. Check that you are connected to management AP. You might get disconnected during attack.");
        getStatus();
    };
    statusRequest.ontimeout = function () {
        console.log("Request timeout");
        getStatus();
    };
    statusRequest.open("GET", ESP_URL + "/status", true);
    statusRequest.responseType = "arraybuffer";
    statusRequest.send();
}


function countProgress() {
    if (timeElapsed >= attackTimeout) {
        $("errors").innerHTML = "Please reconnect to management AP";
        $("errors").style.display = "block";
        clearInterval(runningPoll);
    }
    $("running-progress").innerHTML = timeElapsed + "/" + attackTimeout + "s";
    timeElapsed++;
}


function showResult(status, attackType, attackContentSize, attackContent) {
    clearInterval(poll);
    $("results").innerHTML = defaultResultContent;
    $("result-meta").innerHTML = status + "<br>";
    type = "ERROR: Cannot parse attack type.";
    switch (attackType) {
        case AttackTypeEnum.ATTACK_TYPE_PASSIVE:
            type = "ATTACK_TYPE_PASSIVE";
            break;
        case AttackTypeEnum.ATTACK_TYPE_HANDSHAKE:
            type = "ATTACK_TYPE_HANDSHAKE";
            resultHandshake(attackContent, attackContentSize);
            break;
        case AttackTypeEnum.ATTACK_TYPE_PMKID:
            type = "ATTACK_TYPE_PMKID";
            resultPmkid(attackContent, attackContentSize);
            break;
        case AttackTypeEnum.ATTACK_TYPE_DOS:
            type = "ATTACK_TYPE_DOS";
            break;
        default:
            type = "UNKNOWN";
    }
    $("result-meta").innerHTML += type + "<br>";
}


function generateRow(rowId, ssid, bssid, rssi) {
    tr = document.createElement('tr');
    tr.setAttribute("id", rowId);
    tr.setAttribute("onClick", "selectAp(this)");
    tr.innerHTML = `<td>${ssid}</td><td>${bssid}</td><td>${rssi}</td>`;
    return tr;
}


function fetchAps() {
    updateError(null);
    selectedApElement = null;
    $("ap-loader").style.display = "block";
    let apList = $("ap-list");
    apList.innerHTML = "";
    var apRequest = new XMLHttpRequest();
    apRequest.onload = function () {
        $("ap-loader").style.display = "none";
        apList.innerHTML = "<th>SSID</th><th>BSSID</th><th>RSSI</th>";
        var arrayBuffer = apRequest.response;
        if (arrayBuffer) {
            var byteArray = new Uint8Array(arrayBuffer);
            for (let i = 0; i < byteArray.byteLength; i = i + 40) {
                var bssid = [];
                for (let j = 0; j < 6; j++) {
                    bssid.push(uint8ToHex(byteArray[i + 33 + j]));
                }
                apList.appendChild(
                    generateRow(
                        i / 40,
                        new TextDecoder("utf-8").decode(byteArray.subarray(i + 0, i + 32)),
                        bssid.join(':'),
                        byteArray[i + 39] - 255
                    )
                );
            }
        }
    };
    apRequest.onerror = function () {
        $("ap-loader").style.display = "none";
        apList.innerHTML = "ERROR";
        updateError('Unable to load AP list')
    };
    apRequest.open("GET", ESP_URL + "/ap-list", true);
    apRequest.responseType = "arraybuffer";
    apRequest.send();
}


function selectAp(el) {
    if (selectedApElement != null) {
        selectedApElement.classList.remove("selected")
    }
    selectedApElement = el;
    el.classList.add("selected");
}


function runAttack() {
    if (selectedApElement == null) {
        updateError("Attack not started. No AP selected.");
        return;
    }
    var arrayBuffer = new ArrayBuffer(4);
    var uint8Array = new Uint8Array(arrayBuffer);
    uint8Array[0] = parseInt(selectedApElement.id);
    uint8Array[1] = parseInt($("attack_type").value);
    uint8Array[2] = parseInt($("attack_method").value);
    uint8Array[3] = parseInt($("attack_timeout").value);
    var oReq = new XMLHttpRequest();
    oReq.open("POST", ESP_URL + "/run-attack", true);
    oReq.send(arrayBuffer);

    getStatus();

    attackTimeout = parseInt($("attack_timeout").value);
    timeElapsed = 0;
    runningPoll = setInterval(countProgress, RUNNING_POLL_INTERVAL);
}


function resetAttack() {
    showSection("setup");
    fetchAps();
    var resetRequest = new XMLHttpRequest();
    resetRequest.open("HEAD", ESP_URL + "/reset", true);
    resetRequest.send();
}


function resultPmkid(attackContent, attackContentSize) {
    var macAp = "";
    var macSta = "";
    var ssid = "";
    var ssidText = "";
    var pmkid = "";
    var index = 0;
    for (let i = 0; i < 6; i = i + 1) {
        macAp += uint8ToHex(attackContent[index + i]);
    }
    index += 6;
    for (let i = 0; i < 6; i = i + 1) {
        macSta += uint8ToHex(attackContent[index + i]);
    }
    index += 6;
    for (let i = 0; i < attackContent[index]; i = i + 1) {
        ssid += uint8ToHex(attackContent[index + 1 + i]);
        ssidText += String.fromCharCode(attackContent[index + 1 + i]);
    }
    index += attackContent[index] + 1;
    var pmkidCount = 0;
    for (let i = 0; i < attackContentSize - index; i = i + 1) {
        if ((i % 16) == 0) {
            pmkid += "<br>";
            pmkid += "</code>PMKID #" + pmkidCount + ": <code>";
            pmkidCount += 1;
        }
        pmkid += uint8ToHex(attackContent[index + i]);
    }
    $("result-content").innerHTML = "";
    $("result-content").innerHTML += "MAC AP: <code>" + macAp + "</code><br>";
    $("result-content").innerHTML += "MAC STA: <code>" + macSta + "</code><br>";
    $("result-content").innerHTML += "(E)SSID: <code>" + ssid + "</code> (" + ssidText + ")";
    $("result-content").innerHTML += "<code>" + pmkid + "</code><br>";
    $("result-content").innerHTML += "<br>Hashcat ready format:"
    $("result-content").innerHTML += "<code>" + pmkid + "*" + macAp + "*" + macSta + "*" + ssid + "</code><br>";
}


function resultHandshake(attackContent, attackContentSize) {
    $("result-content").innerHTML = "";
    var pcapLink = document.createElement("a");
    pcapLink.setAttribute("href", "capture.pcap");
    pcapLink.text = "Download PCAP file";
    var hccapxLink = document.createElement("a");
    hccapxLink.setAttribute("href", "capture.hccapx");
    hccapxLink.text = "Download HCCAPX file";
    $("result-content").innerHTML += "<p>" + pcapLink.outerHTML + "</p>";
    $("result-content").innerHTML += "<p>" + hccapxLink.outerHTML + "</p>";
    var handshakes = "";
    for (let i = 0; i < attackContentSize; i = i + 1) {
        handshakes += uint8ToHex(attackContent[i]);
        if (i % 50 == 49) {
            handshakes += "\n";
        }
    }
    $("result-content").innerHTML += "<pre><code>" + handshakes + "</code></pre>";
}


function uint8ToHex(uint8) {
    return ("00" + uint8.toString(16)).slice(-2);
}


function updateConfigurableFields(el) {
    $("attack_method").outerHTML = defaultAttackMethods;
    switch (parseInt(el.value)) {
        case AttackTypeEnum.ATTACK_TYPE_PASSIVE:
            console.log("PASSIVE configuration");
            break;
        case AttackTypeEnum.ATTACK_TYPE_HANDSHAKE:
            console.log("HANDSHAKE configuration");
            $("attack_timeout").value = 60;
            setAttackMethods(["DEAUTH_ROGUE_AP (PASSIVE)", "DEAUTH_BROADCAST (ACTIVE)", "CAPTURE_ONLY (PASSIVE)"]);
            break;
        case AttackTypeEnum.ATTACK_TYPE_PMKID:
            console.log("PMKID configuration");
            $("attack_timeout").value = 5;
            break;
        case AttackTypeEnum.ATTACK_TYPE_DOS:
            console.log("DOS configuration");
            $("attack_timeout").value = 120;
            setAttackMethods(["DEAUTH_ROGUE_AP (PASSIVE)", "DEAUTH_BROADCAST (ACTIVE)", "DEAUTH_COMBINE_ALL"]);
            break;
        default:
            console.log("Unknown attack type");
            break;
    }
}


function setAttackMethods(attackMethodsArray) {
    $("attack_method").removeAttribute("disabled");
    attackMethodsArray.forEach(function (method, index) {
        let option = document.createElement("option");
        option.value = index;
        option.text = method;
        option.selected = true;
        $("attack_method").appendChild(option);
    });
}
