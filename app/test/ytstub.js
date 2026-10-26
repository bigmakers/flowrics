/* YouTube IFrame API の代替スタブ(テスト用)。内蔵プレイリスト(loadPlaylist / cuePlaylist / playVideoAt / setLoop)と、
   曲が終わったときの自動進行、埋め込み不可動画(BADBAD…)のエラー、list= 取り込み(PL…)を模倣する。 */
window.YT = { PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  Player: class {
    constructor(id, opts) {
      const f = document.createElement('iframe'); f.id = id; f.src = 'about:blank'; document.getElementById(id).replaceWith(f);
      this.opts = opts; this.state = -1; this.t = 0; this.dur = 256; this.vid = null; this.pl = null; this.pi = 0; this.loop = false; this.list = null; window.__stub = this;
      setTimeout(() => opts.events.onReady({ target: this }), 50);
      setInterval(() => { if (this.state === 1) { this.t += 0.05; if (this.t >= this.dur) { this.t = this.dur; this.set(0); } } }, 50);
    }
    set(s) {
      this.state = s; this.opts.events.onStateChange({ data: s, target: this });
      if (s === 0 && this.pl && this.state === 0) { const n = this.pi + 1; if (n < this.pl.length || this.loop) setTimeout(() => { if (this.state === 0) this.playVideoAt(n % this.pl.length); }, 60); }
    }
    _start(id, startSeconds) {
      this.list = null; this.vid = id; this.t = startSeconds || 0; this.lastStart = startSeconds; this.set(-1);
      setTimeout(() => { if (String(id).startsWith('BADBAD')) { this.opts.events.onError({ data: 150 }); return; } this.set(3); setTimeout(() => this.set(1), 100); }, 100);
    }
    loadVideoById(id) { if (typeof id === 'object') this._start(id.videoId, id.startSeconds); else this._start(id, 0); }
    cueVideoById(id) { this.list = null; this.vid = id; this.t = 0; setTimeout(() => this.set(5), 100); }
    loadPlaylist(o) { this.pl = o.playlist.slice(); this.pi = o.index || 0; this._start(this.pl[this.pi], o.startSeconds || 0); }
    cuePlaylist(o) {
      if (o.list) { this.list = o.list; this.pl = null; this.state = -1; setTimeout(() => { if (o.list.startsWith('PLBAD')) { this.opts.events.onError({ data: 150 }); return; } this.vid = 'p1p1p1p1p1p'; this.t = 0; this.set(5); }, 100); return; }
      this.list = null; this.pl = o.playlist.slice(); this.pi = o.index || 0; this.vid = this.pl[this.pi]; this.t = 0; setTimeout(() => this.set(5), 100);
    }
    playVideoAt(i) { if (!this.pl) return; this.pi = i; this._start(this.pl[i], 0); }
    getPlaylist() { if (this.list) return this.list.startsWith('PLBAD') ? null : ['p1p1p1p1p1p', 'p2p2p2p2p2p', 'SX_ViT4Ra7k']; return this.pl ? this.pl.slice() : null; }
    getPlaylistIndex() { return this.pi || 0; }
    setLoop(b) { this.loop = !!b; }
    playVideo() { this.set(1); } pauseVideo() { this.set(2); } stopVideo() { this.set(-1); }
    seekTo(t) { this.t = t; } getCurrentTime() { return this.t; } getDuration() { return this.dur; } getPlayerState() { return this.state; }
    getVideoData() {
      return { video_id: this.vid,
        title: this.vid === 'SX_ViT4Ra7k' ? '米津玄師 MV「Lemon」' : this.vid === 'dQw4w9WgXcQ' ? 'Other Artist - Some Song (Official Video)' : 'Video ' + this.vid,
        author: this.vid === 'SX_ViT4Ra7k' ? '米津玄師' : this.vid === 'dQw4w9WgXcQ' ? 'OtherVEVO' : 'Ch ' + this.vid };
    }
  } };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();
