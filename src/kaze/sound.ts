// TODO - Modernize this garbage

/*
export = {
    loaded: {},

    load: function (name, path, times, onFinish) {
        if (times === undefined) 
            times = 1;
        this.loaded[name] = {
            index: 0,
            array: []
        };
        for (let i = 0; i < times; ++i) {
            let audio = new Audio();
            audio.src = path;
            audio.preload = 'auto';
            if (onFinish !== undefined)
                audio.addEventListener('canplaythrough', onFinish);
            this.loaded[name].array.push(audio);
        }
    },

    play: function (name) {
        let a = this.loaded[name];
        a.array[a.index].play();
        a.index++;
        a.index %= a.array.length;
    },

    playAndFade: function (name, duration, fadeDuration, interval) {
        let audio = this.loaded[name];
        audio.play();
        setTimeout(function () {
            let remaining = fadeDuration;
            let repeat = setInterval(function () {
                remaining -= interval;
                if (remaining <= 0) {
                    audio.pause();
                    audio.currentTime = 0;
                    clearInterval(repeat);
                    return;
                }
                audio.volume = remaining / fadeDuration;
            }, interval);
        }, duration);
    }
};
 */
