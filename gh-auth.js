"use strict";

class GithubAuth {

	constructor(appId, env, token) {
		this.appId = appId;
		this.env = env;
		this.token = token || sessionStorage.staticPagesCmsToken || '';
	}

	redirectURL() {
		return location.href.replace(/[?#].+/g, '');
	}

	start() {
		sessionStorage.staticPagesCmsAuthState = Math.random();
		location.href = `https://github.com/login/oauth/authorize?client_id=${this.appId}&redirect_uri=${encodeURIComponent(this.redirectURL())}&state=${sessionStorage.staticPagesCmsAuthState}`;
	}

	fetchToken(code) {
		fetch(`https://ci7luqxjw2.execute-api.eu-central-1.amazonaws.com/default/static-pages-cms-github-token?env=${this.env}&code=${code}`).then(rsp => rsp.json()).then(rsp => {
			this.token = sessionStorage.staticPagesCmsToken = rsp.access_token;
			delete sessionStorage.staticPagesCmsAuthState;
			location.href = this.redirectURL();
		});
	}

	process() {
		if (!this.token) {
			const query = new URLSearchParams(location.search);
			const code = query.get('code');
			if (code) {
				document.body.dataset.state = 'authenticating';
				this.fetchToken(code);
			}
		}
		else {
			document.body.dataset.state = 'authenticated';
			return true;
		}
	}

	get(url) {
		return fetch(new Request(url, {
			headers: {"Authorization": `token ${github.token}`}
		})).then(x => x.json());
	}

	b64decode(b64) {
		return decodeURIComponent(escape(atob(b64.trim())));
	}

}
