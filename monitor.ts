import axios from 'axios';
import EventEmitter from 'events';
import createLogger from 'logging';

const log = createLogger('Monitor');

export class Monitor extends EventEmitter {
	token: string;
	alerts: {active: boolean, since: Date}[] = Array.from(Array(25)).fill({active: false, since: new Date(0)});
	private lastModified: string = "Mon, 1 Jan 2000 12:00:00 GMT";
	private intervalId: NodeJS.Timeout | undefined;

	constructor(token: string) {
		super();
		this.token = token;
	}

	start() {
		this.intervalId = setInterval(async () => {
			const response = await axios.get("https://api.alerts.in.ua/v1/iot/active_air_raid_alerts_by_oblast.json", {
				headers: {
					'Authorization': `Bearer ${this.token}`,
					'If-Modified-Since': this.lastModified
				},
				validateStatus: s => [200, 304, 429].includes(s)
			}).catch(e => log.error("Failed to fetch alerts:", e));

			log.debug(`Response code ${response?.status}`);
			switch (response?.status) {
				case 200:
					this.lastModified = response.headers['last-modified'];
					const split = response.data.split('');

					// Delete permanent alerts
					split.splice(0, 1)
					split.splice(11, 1)

					const mapped: {active: boolean, since: Date}[] = split.map((a: string, i: number) => ({ active: a === 'A', since: this.alerts[i].active ? this.alerts[i].since : new Date() }));

					if (this.alerts.map(a => a.active).join('') !== mapped.map(a => a.active).join('')) {
						log.debug(`Alerts: ${split.join('')}, Last-Modified: ${this.lastModified}`);

						this.emit('update', this.alerts, mapped);
						this.alerts = mapped;
					}

					break;
				case 304:
					log.debug("No new alerts");
					break;
				case 429:
					log.warn("Rate limit exceeded");
					break;
				default:
					log.error(`Unexpected status code ${response?.status}`, response?.data);
			}
		}, 1e4); // 10 seconds
		log.info("Alert monitoring started.");
		return this;
	}

	stop() {
		clearInterval(this.intervalId);
		log.info("Alert monitoring stopped.");
		return this;
	}
}