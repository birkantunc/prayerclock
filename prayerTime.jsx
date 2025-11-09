// PrayerClock.jsx — Übersicht widget

// Refresh every minute so the hand/text stay current (we also run our own setInterval)
export const refreshFrequency = 60 * 1000;
export const command = "echo 'Loading...'";

// Position & styles (Emotion CSS). Tweak top/left to move the widget.
export const className = `
    position: absolute;
    top: 24px;
    left: 24px;
    background: transparent;
    font-family: Arial, sans-serif;

    .container {
    max-width: 340px;
    padding: 0;
    background: transparent;
    }

    .dial { position: relative; width:220px; height:220px; }
    .pie  { position:absolute; inset:0; width:220px; height:220px; border-radius:50%;
            box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .inner{ position:absolute; top:50%; left:50%; width:180px; height:180px; background:#fff;
            border-radius:50%; box-shadow: 0 2px 8px rgba(0,0,0,.1); transform: translate(-50%, -50%); z-index:1; }
    .hand { position:absolute; left:50%; bottom:50%; width:3px; background:#111; border-radius:2px; 
            transform-origin: bottom center; z-index:2; }

    .timewrap { position:absolute; left:50%; top:50%; transform: translateX(-50%); z-index:3;
                text-align:center; line-height:1.15; }
    .now { font-size: 24px; font-weight: 300; }
    .rem { margin-top: 3px; font-size: 24px; font-weight: 600; }
`;

// --- Your original logic, adapted as plain functions we call after render ---
const DAY_SEC = 24 * 60 * 60;

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
            return {
                fajr:    toSec(t.Fajr),
                sunrise: toSec(t.Sunrise),
                dhuhr:   toSec(t.Dhuhr),
                asr:     toSec(t.Asr),
                maghrib: toSec(t.Maghrib),
                isha:    toSec(t.Isha)
            };
        });
}

// Convert seconds to degrees in 24h day
function secToDeg(s){ return (s / DAY_SEC) * 360; }

// Build pie where 0° = Fajr and 360° = next Fajr
function buildClockGradient(times){
    var c1='#6FB1FF'; // Fajr
    var c2='#E6E6E6'; // Sunrise
    var c3='#8bd17c'; // Dhuhr
    var c4='#ffd166'; // Asr
    var c5='#F84E3D'; // Maghrib
    var c6='#4E4242'; // Isha

    var base = times.fajr;
    function relDeg(x){ return secToDeg((x - base + DAY_SEC) % DAY_SEC); }

    var dFajr = 0;
    var dSun  = relDeg(times.sunrise);
    var dDhr  = relDeg(times.dhuhr);
    var dAsr  = relDeg(times.asr);
    var dMag  = relDeg(times.maghrib);
    var dIsh  = relDeg(times.isha);
    var d360  = 360;

    var stops = [
    c1+' '+dFajr+'deg '+dSun+'deg',
    c2+' '+dSun +'deg '+dDhr+'deg',
    c3+' '+dDhr +'deg '+dAsr+'deg',
    c4+' '+dAsr +'deg '+dMag+'deg',
    c5+' '+dMag +'deg '+dIsh+'deg',
    c6+' '+dIsh +'deg '+d360+'deg'
    ];

    return 'conic-gradient(' + stops.join(', ') + ')';
}

function relDegFromFajr(times, secNow){
    return secToDeg((secNow - times.fajr + DAY_SEC) % DAY_SEC);
}

function nowSecSinceMidnight(){
    var d=new Date();
    return d.getHours()*3600 + d.getMinutes()*60 + d.getSeconds();
}

function updateHand(times){
    var inner = document.getElementById('inner');
    var hand = document.getElementById('hand');
    var radius = Math.floor(Math.min(inner.offsetWidth, inner.offsetHeight)/2) + 7;
    hand.style.height = radius + 'px';
    var angle = relDegFromFajr(times, nowSecSinceMidnight());
    hand.dataset.angle = String(angle);
    hand.style.transform = 'translateX(-50%) rotate(' + angle + 'deg)';
}

//var handTimer = null;

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

function updateTexts(times){
    var nowSec = nowSecSinceMidnight();
    var angle = relDegFromFajr(times, nowSec);
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
        wrap.style.top = '55%';
    } else {
        wrap.style.top = '18%';
    }
}

function display() {
    getPrayerTimes().then(function(times){
        var pie = document.getElementById('pie');
        pie.style.background = buildClockGradient(times);
        updateHand(times);
        updateTexts(times);
        //if (handTimer) { clearInterval(handTimer); }
        //handTimer = setInterval(function(){ updateHand(times); updateTexts(times); }, 60*1000);
    });
}

export const render = () => {
    display();
    return (
        <div className="container">
        <div className="dial">
            <div id="pie" className="pie"></div>
            <div id="hand" className="hand"></div>
            <div id="inner" className="inner"></div>
            <div id="timewrap" className="timewrap">
                <div id="nowTime" className="now"></div>
                <div id="remTime" className="rem"></div>
            </div>
        </div>
        </div>
    );
};
