import axios from 'axios';
import EventEmitter from 'events';
import createLogger from 'logging';

const log = createLogger('Monitor');

export class Monitor extends EventEmitter {
	token: string;
	alerts: string[];
	private lastModified: string;
	private intervalId: NodeJS.Timeout | undefined;

	constructor(token: string) {
		super();
		this.token = token;
		this.alerts = Array.from(Array(25)).fill('N');
		this.lastModified = "Mon, 1 Jan 2000 12:00:00 GMT";
	}

	start() {
		this.intervalId = setInterval(async () => {
			const response = await axios.get("https://api.alerts.in.ua/v1/iot/active_air_raid_alerts_by_oblast.json", {
				headers: {
					'Authorization': `Bearer ${this.token}`,
					'If-Modified-Since': this.lastModified
				}
			}).catch(e => log.error("Failed to fetch alerts", e));

			log.debug(`Response code ${response?.status}`);
			switch (response?.status) {
				case 200:
					this.lastModified = response.headers['Last-Modified'];
					const split = response.data.split('');

					// Delete permanent alerts in Krym and Luhansk
					split.splice(0, 1)
					split.splice(11, 1)

					if (this.alerts.join('') !== split.join('')) {
						this.emit('update', this.alerts, split);
						this.alerts = split;
					}

					break;
				case 304:
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