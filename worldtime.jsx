// PrayerClock.jsx — Übersicht widget

// Refresh every minute so the hand/text stay current (we also run our own setInterval)
export const refreshFrequency = 60 * 1000;
export const command = "echo 'Loading...'";

// Position & styles (Emotion CSS). Tweak top/left to move the widget.
export const className = `
    position: absolute;
    top: 24px;
    left: 47%;
    background: transparent;
    font-family: Arial, sans-serif;

    .container {
    max-width: 340px;
    padding: 0;
    background: transparent;
    }

    .dial {
        position: relative;
        width:220px;
        height:220px;
        margin: 12px auto;
    }

    .pie {
        position:absolute;
        inset:0;
        width: 220px;
        height: 220px;
        border-radius: 50%;
        margin: 0;
        box-shadow: 0 2px 8px rgba(0,0,0,.1);
    }

    .inner {
        position:absolute;
        top:50%;
        left:50%;
        width:180px;
        height:180px;
        background:#fff;
        border-radius:50%;
        box-shadow: 0 2px 8px rgba(0,0,0,.1);
        transform: translate(-50%, -50%);
        z-index:1;
    }

    .hand {
        position:absolute;
        left:50%;
        bottom:50%;
        width:3px;
        background:#111;
        border-radius:2px;
        transform-origin: bottom center;
        z-index:2;
    }

    .list {
        position:absolute;
        left:33%;
        top:22%;
        transform: translateX(-50%);
        font-family: "Courier New", Courier, monospace;
        font-size:10px;
        font-weight:600;
        z-index:1;
    }
    .l-fajr { color:rgb(69, 142, 232); }
    .l-dhuhr { color:rgb(36, 182, 4); }
    .l-asr { color:rgb(242, 171, 4); }
    .l-maghrib { color: #F84E3D; }
    .l-isha { color: #4E4242; }

    .timewrap {
        position:absolute;
        left:50%;
        top:50%;
        transform: translateX(-50%);
        z-index:1;
        text-align:center;
        line-height:1.15;
    }

    .now {
        font-size: 20px;
        font-weight: 300;
    }

    .rem {
        margin-top: 3px;
        font-size: 20px;
        font-weight: 600;
    }
`;

// --- Your original logic, adapted as plain functions we call after render ---
const DAY_SEC = 24 * 60 * 60;
var _TIMES = null;

// Convert absolute seconds to degrees in current 12h block
function relDeg12h(secAbs){
    var blockStart = Math.floor(secAbs / 43200) * 43200; // 0..43199→0, 43200..86399→43200
    return ((secAbs - blockStart) / 43200) * 360;        // 0–360 within current 12h window
}

function nowSecSinceMidnight(){
    var d=new Date();
    return d.getHours()*3600 + d.getMinutes()*60 + d.getSeconds();
}

function fmtHM(sec){
    var h = Math.floor(sec/3600);
    var m = Math.floor((sec%3600)/60);
    var hs = String(h);
    var ms = String(m).padStart(2,'0');
    return hs + ':' + ms;
}

function fmtNow24h(sec){
    var h = Math.floor(sec/3600);
    var m = Math.floor((sec%3600)/60);
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

function nextPrayerRemaining(times, nowSec){
    var seq = [times.fajr, times.sunrise, times.dhuhr, times.asr, times.maghrib, times.isha, times.fajr + DAY_SEC];
    for (var i=0;i<seq.length;i++){
        if (seq[i] > nowSec) {
            return seq[i] - nowSec;
        }
    }
    return (times.fajr + DAY_SEC) - nowSec;
}

// times in seconds since 00:00
function getPrayerTimes() {
    const city = "Philadelphia";
    const country = "US";
    const method = 2;   // ISNA
    const school = 0;   // Standard (Shafi/Maliki/Hanbali). Use 1 for Hanafi.
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${country}&method=${method}&school=${school}`;

    const toSec = (hhmm) => {
        const [hh, mm] = hhmm.split(":").map(Number);
        return (hh * 3600) + (mm * 60);
    };

    return fetch(url)
    .then(res => {
        if (!res.ok) throw new Error("Aladhan request failed");
        return res.json();
    })
    .then(json => {
        const t = json && json.data && json.data.timings ? json.data.timings : {};
        _TIMES = {
            fajr:    toSec(t.Fajr),
            sunrise: toSec(t.Sunrise),
            dhuhr:   toSec(t.Dhuhr),
            asr:     toSec(t.Asr),
            maghrib: toSec(t.Maghrib),
            isha:    toSec(t.Isha)
        };
        return _TIMES;
    });
}

// 12-hour dial coloring: 0°=12 o’clock, 90°=3, 180°=6, 270°=9
function buildClockGradient(times){
    var c1='#6FB1FF'; // Fajr
    var c2='#E6E6E6'; // Sunrise
    var c3='#8bd17c'; // Dhuhr
    var c4='#ffd166'; // Asr
    var c5='#F84E3D'; // Maghrib
    var c6='#4E4242'; // Isha

    var now = nowSecSinceMidnight();
    var blockStart = Math.floor(now / 43200) * 43200; // 0..43199 → 0, 43200..86399 → 43200
    var blockEnd   = blockStart + 43200;

    function toDeg(secAbs){
        return ((secAbs - blockStart) / 43200) * 360; // assumes secAbs clipped inside block
    }
    function addSlice(a, b, color, out){
        var s = Math.max(a, blockStart);
        var e = Math.min(b, blockEnd);
        if (e <= s) return;
        out.push(color + ' ' + toDeg(s) + 'deg ' + toDeg(e) + 'deg');
    }

    var stops = [];
    addSlice(0,             times.fajr,            c6, stops);
    addSlice(times.fajr,    times.sunrise,         c1, stops);
    addSlice(times.sunrise, times.dhuhr,           c2, stops);
    addSlice(times.dhuhr,   times.asr,             c3, stops);
    addSlice(times.asr,     times.maghrib,         c4, stops);
    addSlice(times.maghrib, times.isha,            c5, stops);
    addSlice(times.isha,    times.fajr + DAY_SEC,  c6, stops);

    return 'conic-gradient(' + stops.join(', ') + ')';
}

// Hand shows current time within the current 12h block (0° at 12 o’clock)
function updateHand(){
    var inner = document.getElementById('inner');
    var hand  = document.getElementById('hand');
    var radius = Math.floor(Math.min(inner.offsetWidth, inner.offsetHeight)/2) + 7;
    hand.style.height = radius + 'px';

    var nowSec = nowSecSinceMidnight();
    var angle  = relDeg12h(nowSec);

    hand.dataset.angle = String(angle);
    hand.style.transform = 'translateX(-50%) rotate(' + angle + 'deg)';
}

function updateTexts(times){
    // list times
    var timeList = document.getElementById('list');
    document.getElementById('l-fajr').textContent = fmtNow24h(times.fajr);
    document.getElementById('l-dhuhr').textContent = fmtNow24h(times.dhuhr);
    document.getElementById('l-asr').textContent = fmtNow24h(times.asr);
    document.getElementById('l-maghrib').textContent = fmtNow24h(times.maghrib);
    document.getElementById('l-isha').textContent = fmtNow24h(times.isha);
    
    // now and remaining
    var nowSec = nowSecSinceMidnight();
    var angle = relDeg12h(nowSec);
    var nowEl = document.getElementById('nowTime');
    var remEl = document.getElementById('remTime');
    var wrap = document.getElementById('timewrap');

    nowEl.textContent = fmtNow24h(nowSec);
    var rem = nextPrayerRemaining(times, nowSec);
    remEl.textContent = fmtHM(rem);
    // if less than 30 minutes remaining, highlight
    if ((rem <= 30*60) && (nowSec >= times.dhuhr) && (nowSec <= times.isha)) {
        remEl.style.color = '#FFFFFF';
        remEl.style.backgroundColor = '#CD2929';
        remEl.style.borderRadius = '5px';
        remEl.style.padding = '2px 5px';
    } else {
        remEl.style.color = '#1B1B1B';
        remEl.style.backgroundColor = '#F0F0F0';
        remEl.style.borderRadius = '5px';
        remEl.style.padding = '2px 5px';
    }

    // Position: if in upper half (angle < 90 || angle > 180), place texts in lower half
    if (angle < 90 || angle > 270) {
        wrap.style.top = '60%';
        timeList.style.top = '22%';
    } else {
        wrap.style.top = '17%';
        timeList.style.top = '52%';
    }
}

//var handTimer = null;
async function display() {
    const times = _TIMES || await getPrayerTimes();  // waits only if not cached
    var pie = document.getElementById('pie');
    pie.style.background = buildClockGradient(times);
    updateHand();
    updateTexts(times);
    //if (handTimer) { clearInterval(handTimer); }
    //handTimer = setInterval(function(){ updateHand(times); updateTexts(times); }, 60*1000);
}

export const render = () => {
    display();
    return (
        <div className="container">
        <div className="dial">
            <div id="pie" className="pie"></div>
            <div id="hand" className="hand"></div>
            <div id="inner" className="inner"></div>
            <div id="list" className="list">
                <div><span className="l-fajr">F</span> <span id="l-fajr" className="l-fajr">0:00</span></div>
                <div><span className="l-dhuhr">D</span> <span id="l-dhuhr" className="l-dhuhr">0:00</span></div>
                <div><span className="l-asr">A</span> <span id="l-asr" className="l-asr">0:00</span></div>
                <div><span className="l-maghrib">M</span> <span id="l-maghrib" className="l-maghrib">0:00</span></div>
                <div><span className="l-isha">I</span> <span id="l-isha" className="l-isha">0:00</span></div>
            </div>
            <div id="timewrap" className="timewrap">
                <div id="nowTime" className="now"></div>
                <div id="remTime" className="rem"></div>
            </div>
        </div>
        </div>
    );
};
