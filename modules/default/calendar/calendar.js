/* global Module */

/* Magic Mirror
 * Module: Calendar
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

Module.register("calendar", {

	// Define module defaults
	defaults: {
		maximumEntries: 3, // Total Maximum Entries
		maximumNumberOfDays: 365,
		displaySymbol: true,
		defaultSymbol: "calendar", // Fontawesome Symbol see http://fontawesome.io/cheatsheet/
		showLocation: true,
		displayRepeatingCountTitle: true,
		defaultRepeatingCountTitle: "",
		maxTitleLength: 100,
		wrapEvents: false, // wrap events to multiple lines breaking at maxTitleLength
		maxTitleLines: 3,
		fetchInterval: 1 * 60 * 1000, // Update every 5 minutes.
		animationSpeed: 2000,
		fade: true,
		urgency: 7,
		timeFormat: "relative",
		dateFormat: "MMM Do",
		dateEndFormat: "LT",
		fullDayEventDateFormat: "MMM Do",
		showEnd: false,
		getRelative: 6,
		fadePoint: 0.25, // Start on 1/4th of the list.
		hidePrivate: false,
		hideOngoing: false,
		colored: false,
		coloredSymbolOnly: false,
		tableClass: "small",
		calendars: [
			{
				symbol: "calendar",
				url: "https://calendar.google.com/calendar/ical/teamsmartmirror.ig%40gmail.com/public/basic.ics",
			},
		],
		titleReplace: {
			"De verjaardag van ": "",
			"'s birthday": ""
		},
		broadcastEvents: true,
		excludedEvents: [],
		sliceMultiDayEvents: false,
		broadcastPastEvents: false,
		nextDaysRelative: false
	},

	// Define required scripts.
	getStyles: function () {
		return ["calendar.css", "font-awesome.css"];
	},

	// Define required scripts.
	getScripts: function () {
		return ["moment.js"];
	},

	// Define required translations.
	getTranslations: function () {
		// The translations for the default modules are defined in the core translation files.
		// Therefor we can just return false. Otherwise we should have returned a dictionary.
		// If you're trying to build your own module including translations, check out the documentation.
		return false;
	},

	// Override start method.
	start: function () {
		Log.log("Starting module: " + this.name);

		// Set locale.
		moment.updateLocale(config.language, this.getLocaleSpecification(config.timeFormat));

		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			calendar.url = calendar.url.replace("webcal://", "http://");

			var calendarConfig = {
				maximumEntries: calendar.maximumEntries,
				maximumNumberOfDays: calendar.maximumNumberOfDays,
				broadcastPastEvents: calendar.broadcastPastEvents,
			};
			if (calendar.symbolClass === "undefined" || calendar.symbolClass === null) {
				calendarConfig.symbolClass = "";
			}
			if (calendar.titleClass === "undefined" || calendar.titleClass === null) {
				calendarConfig.titleClass = "";
			}
			if (calendar.timeClass === "undefined" || calendar.timeClass === null) {
				calendarConfig.timeClass = "";
			}

			// we check user and password here for backwards compatibility with old configs
			if(calendar.user && calendar.pass) {
				Log.warn("Deprecation warning: Please update your calendar authentication configuration.");
				Log.warn("https://github.com/MichMich/MagicMirror/tree/v2.1.2/modules/default/calendar#calendar-authentication-options");
				calendar.auth = {
					user: calendar.user,
					pass: calendar.pass
				};
			}

			this.addCalendar(calendar.url, calendar.auth, calendarConfig);

			// Trigger ADD_CALENDAR every fetchInterval to make sure there is always a calendar
			// fetcher running on the server side.
			var self = this;
			setInterval(function() {
				self.addCalendar(calendar.url, calendar.auth, calendarConfig);
			}, self.config.fetchInterval);
		}

		this.calendarData = {};
		this.loaded = false;
	},

	// Override socket notification handler.
	socketNotificationReceived: function (notification, payload) {
		if (notification === "CALENDAR_EVENTS") {
			if (this.hasCalendarURL(payload.url)) {
				this.calendarData[payload.url] = payload.events;
				this.loaded = true;

				if (this.config.broadcastEvents) {
					this.broadcastEvents();
				}
			}
		} else if (notification === "FETCH_ERROR") {
			Log.error("Calendar Error. Could not fetch calendar: " + payload.url);
			this.loaded = true;
		} else if (notification === "INCORRECT_URL") {
			Log.error("Calendar Error. Incorrect url: " + payload.url);
		} else {
			Log.log("Calendar received an unknown socket notification: " + notification);
		}

		this.updateDom(this.config.animationSpeed);
	},

	// Override dom generator.
	getDom: function () {

		var events = this.createEventList();
		var wrapper = document.createElement("table");
		wrapper.className = this.config.tableClass;

		if (events.length === 0) {
			wrapper.innerHTML = (this.loaded) ? this.translate("EMPTY") : this.translate("LOADING");
			wrapper.className = this.config.tableClass + " dimmed";
			return wrapper;
		}

		if (this.config.fade && this.config.fadePoint < 1) {
			if (this.config.fadePoint < 0) {
				this.config.fadePoint = 0;
			}
			var startFade = events.length * this.config.fadePoint;
			var fadeSteps = events.length - startFade;
		}

		var currentFadeStep = 0;
		var lastSeenDate = "";

		for (var e in events) {
			var event = events[e];
			var dateAsString = moment(event.startDate, "x").format(this.config.dateFormat);
			if(this.config.timeFormat === "dateheaders"){
				if(lastSeenDate !== dateAsString){
					var dateRow = document.createElement("tr");
					dateRow.className = "normal";
					var dateCell = document.createElement("td");

					dateCell.colSpan = "3";
					dateCell.innerHTML = dateAsString;
					dateRow.appendChild(dateCell);
					wrapper.appendChild(dateRow);

					if (e >= startFade) {			//fading
						currentFadeStep = e - startFade;
						dateRow.style.opacity = 1 - (1 / fadeSteps * currentFadeStep);
					}

					lastSeenDate = dateAsString;
				}
			}

			var eventWrapper = document.createElement("tr");

			if (this.config.colored && !this.config.coloredSymbolOnly) {
				eventWrapper.style.cssText = "color:" + this.colorForUrl(event.url);
			}

			eventWrapper.className = "normal";

			if (this.config.displaySymbol) {
				var symbolWrapper = document.createElement("td");

				if (this.config.colored && this.config.coloredSymbolOnly) {
					symbolWrapper.style.cssText = "color:" + this.colorForUrl(event.url);
				}

				var symbolClass = this.symbolClassForUrl(event.url);
				symbolWrapper.className = "symbol align-right " + symbolClass;

				var symbols = this.symbolsForUrl(event.url);
				if(typeof symbols === "string") {
					symbols = [symbols];
				}

				for(var i = 0; i < symbols.length; i++) {
					var symbol = document.createElement("span");
					symbol.className = "fa fa-fw fa-" + symbols[i];
					if(i > 0){
						symbol.style.paddingLeft = "5px";
					}
					symbolWrapper.appendChild(symbol);
				}
				eventWrapper.appendChild(symbolWrapper);
			} else if(this.config.timeFormat === "dateheaders"){
				var blankCell = document.createElement("td");
				blankCell.innerHTML = "&nbsp;&nbsp;&nbsp;";
				eventWrapper.appendChild(blankCell);
			}

			var titleWrapper = document.createElement("td"),
				repeatingCountTitle = "";

			if (this.config.displayRepeatingCountTitle && event.firstYear !== undefined) {

				repeatingCountTitle = this.countTitleForUrl(event.url);

				if (repeatingCountTitle !== "") {
					var thisYear = new Date(parseInt(event.startDate)).getFullYear(),
						yearDiff = thisYear - event.firstYear;

					repeatingCountTitle = ", " + yearDiff + ". " + repeatingCountTitle;
				}
			}

			titleWrapper.innerHTML = this.titleTransform(event.title) + repeatingCountTitle;

			var titleClass = this.titleClassForUrl(event.url);

			if (!this.config.colored) {
				titleWrapper.className = "title bright " + titleClass;
			} else {
				titleWrapper.className = "title " + titleClass;
			}

			if(this.config.timeFormat === "dateheaders"){

				if (event.fullDayEvent) {
					titleWrapper.colSpan = "2";
					titleWrapper.align = "left";

				} else {

					var timeClass = this.timeClassForUrl(event.url);
					var timeWrapper = document.createElement("td");
					timeWrapper.className = "time light " + timeClass;
					timeWrapper.align = "left";
					timeWrapper.style.paddingLeft = "2px";
					timeWrapper.innerHTML = moment(event.startDate, "x").format("LT");
					eventWrapper.appendChild(timeWrapper);
					titleWrapper.align = "right";
				}

				eventWrapper.appendChild(titleWrapper);
			} else {
				var timeWrapper = document.createElement("td");

				eventWrapper.appendChild(titleWrapper);
				//console.log(event.today);
				var now = new Date();
				// Define second, minute, hour, and day variables
				var oneSecond = 1000; // 1,000 milliseconds
				var oneMinute = oneSecond * 60;
				var oneHour = oneMinute * 60;
				var oneDay = oneHour * 24;
				if (event.fullDayEvent) {
					//subtract one second so that fullDayEvents end at 23:59:59, and not at 0:00:00 one the next day
					event.endDate -= oneSecond;
					if (event.today) {
						timeWrapper.innerHTML = this.capFirst(this.translate("TODAY"));
					} else if (event.startDate - now < oneDay && event.startDate - now > 0) {
						timeWrapper.innerHTML = this.capFirst(this.translate("TOMORROW"));
					} else if (event.startDate - now < 2 * oneDay && event.startDate - now > 0) {
						if (this.translate("DAYAFTERTOMORROW") !== "DAYAFTERTOMORROW") {
							timeWrapper.innerHTML = this.capFirst(this.translate("DAYAFTERTOMORROW"));
						} else {
							timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").fromNow());
						}
					} else {
						/* Check to see if the user displays absolute or relative dates with their events
						* Also check to see if an event is happening within an 'urgency' time frameElement
						* For example, if the user set an .urgency of 7 days, those events that fall within that
						* time frame will be displayed with 'in xxx' time format or moment.fromNow()
						*
						* Note: this needs to be put in its own function, as the whole thing repeats again verbatim
						*/
						if (this.config.timeFormat === "absolute") {
							if ((this.config.urgency > 1) && (event.startDate - now < (this.config.urgency * oneDay))) {
								// This event falls within the config.urgency period that the user has set
								timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").from(moment().format("YYYYMMDD")));
							} else {
								timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").format(this.config.fullDayEventDateFormat));
							}
						} else {
							timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").from(moment().format("YYYYMMDD")));
						}
					}
					if(this.config.showEnd){
						timeWrapper.innerHTML += "-" ;
						timeWrapper.innerHTML += this.capFirst(moment(event.endDate  , "x").format(this.config.fullDayEventDateFormat));
					}
				} else {
					if (event.startDate >= new Date()) {
						if (event.startDate - now < 2 * oneDay) {
							// This event is within the next 48 hours (2 days)
							if (event.startDate - now < this.config.getRelative * oneHour) {
								// If event is within 6 hour, display 'in xxx' time format or moment.fromNow()
								timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").fromNow());
							} else {
								if(this.config.timeFormat === "absolute" && !this.config.nextDaysRelative) {
									timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").format(this.config.dateFormat));
								} else {
									// Otherwise just say 'Today/Tomorrow at such-n-such time'
									timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").calendar());
								}
							}
						} else {
							/* Check to see if the user displays absolute or relative dates with their events
							* Also check to see if an event is happening within an 'urgency' time frameElement
							* For example, if the user set an .urgency of 7 days, those events that fall within that
							* time frame will be displayed with 'in xxx' time format or moment.fromNow()
							*
							* Note: this needs to be put in its own function, as the whole thing repeats again verbatim
							*/
							if (this.config.timeFormat === "absolute") {
								if ((this.config.urgency > 1) && (event.startDate - now < (this.config.urgency * oneDay))) {
									// This event falls within the config.urgency period that the user has set
									timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").fromNow());
								} else {
									timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").format(this.config.dateFormat));
								}
							} else {
								timeWrapper.innerHTML = this.capFirst(moment(event.startDate, "x").fromNow());
							}
						}
					} else {
						timeWrapper.innerHTML = this.capFirst(
							this.translate("RUNNING", {
								fallback: this.translate("RUNNING") + " {timeUntilEnd}",
								timeUntilEnd: moment(event.endDate, "x").fromNow(true)
							})
						);
					}
					if (this.config.showEnd) {
						timeWrapper.innerHTML += "-";
						timeWrapper.innerHTML += this.capFirst(moment(event.endDate, "x").format(this.config.dateEndFormat));

					}
				}
				//timeWrapper.innerHTML += ' - '+ moment(event.startDate,'x').format('lll');
				//console.log(event);
				var timeClass = this.timeClassForUrl(event.url);
				timeWrapper.className = "time light " + timeClass;
				eventWrapper.appendChild(timeWrapper);
			}

			wrapper.appendChild(eventWrapper);

			// Create fade effect.
			if (e >= startFade) {
				currentFadeStep = e - startFade;
				eventWrapper.style.opacity = 1 - (1 / fadeSteps * currentFadeStep);
			}

			if (this.config.showLocation) {
				if (event.location !== false) {
					var locationRow = document.createElement("tr");
					locationRow.className = "normal xsmall light";

					if (this.config.displaySymbol) {
						var symbolCell = document.createElement("td");
						locationRow.appendChild(symbolCell);
					}

					var descCell = document.createElement("td");
					descCell.className = "location";
					descCell.colSpan = "2";
					descCell.innerHTML = event.location;
					locationRow.appendChild(descCell);

					wrapper.appendChild(locationRow);

					if (e >= startFade) {
						currentFadeStep = e - startFade;
						locationRow.style.opacity = 1 - (1 / fadeSteps * currentFadeStep);
					}
				}
			}
		}

		return wrapper;
	},

	/**
	 * This function accepts a number (either 12 or 24) and returns a moment.js LocaleSpecification with the
	 * corresponding timeformat to be used in the calendar display. If no number is given (or otherwise invalid input)
	 * it will a localeSpecification object with the system locale time format.
	 *
	 * @param {number} timeFormat Specifies either 12 or 24 hour time format
	 * @returns {moment.LocaleSpecification}
	 */
	getLocaleSpecification: function(timeFormat) {
		switch (timeFormat) {
		case 12: {
			return { longDateFormat: {LT: "h:mm A"} };
			break;
		}
		case 24: {
			return { longDateFormat: {LT: "HH:mm"} };
			break;
		}
		default: {
			return { longDateFormat: {LT: moment.localeData().longDateFormat("LT")} };
			break;
		}
		}
	},

	/* hasCalendarURL(url)
	 * Check if this config contains the calendar url.
	 *
	 * argument url string - Url to look for.
	 *
	 * return bool - Has calendar url
	 */
	hasCalendarURL: function (url) {
		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			if (calendar.url === url) {
				return true;
			}
		}

		return false;
	},

	/* createEventList()
	 * Creates the sorted list of all events.
	 *
	 * return array - Array with events.
	 */
	createEventList: function () {
		var events = [];
		var today = moment().startOf("day");
		var now = new Date();
		var future = moment().startOf("day").add(this.config.maximumNumberOfDays, "days").toDate();
		for (var c in this.calendarData) {
			var calendar = this.calendarData[c];
			for (var e in calendar) {
				var event = JSON.parse(JSON.stringify(calendar[e])); // clone object
				if(event.endDate < now) {
					continue;
				}
				if(this.config.hidePrivate) {
					if(event.class === "PRIVATE") {
						  // do not add the current event, skip it
						  continue;
					}
				}
				if(this.config.hideOngoing) {
					if(event.startDate < now) {
						continue;
					}
				}
				if(this.listContainsEvent(events,event)){
					continue;
				}
				event.url = c;
				event.today = event.startDate >= today && event.startDate < (today + 24 * 60 * 60 * 1000);

				/* if sliceMultiDayEvents is set to true, multiday events (events exceeding at least one midnight) are sliced into days,
				* otherwise, esp. in dateheaders mode it is not clear how long these events are.
				*/
				var maxCount = Math.ceil(((event.endDate - 1) - moment(event.startDate, "x").endOf("day").format("x"))/(1000*60*60*24)) + 1;
				if (this.config.sliceMultiDayEvents && maxCount > 1) {
					var splitEvents = [];
					var midnight = moment(event.startDate, "x").clone().startOf("day").add(1, "day").format("x");
					var count = 1;
					while (event.endDate > midnight) {
						var thisEvent = JSON.parse(JSON.stringify(event)); // clone object
						thisEvent.today = thisEvent.startDate >= today && thisEvent.startDate < (today + 24 * 60 * 60 * 1000);
						thisEvent.endDate = midnight;
						thisEvent.title += " (" + count + "/" + maxCount + ")";
						splitEvents.push(thisEvent);

						event.startDate = midnight;
						count += 1;
						midnight = moment(midnight, "x").add(1, "day").format("x"); // next day
					}
					// Last day
					event.title += " ("+count+"/"+maxCount+")";
					splitEvents.push(event);

					for (event of splitEvents) {
						if ((event.endDate > now) && (event.endDate <= future)) {
							events.push(event);
						}
					}
				} else {
					events.push(event);
				}
			}
		}

		events.sort(function (a, b) {
			return a.startDate - b.startDate;
		});
		return events.slice(0, this.config.maximumEntries);
	},

	listContainsEvent: function(eventList, event){
		for(var evt of eventList){
			if(evt.title === event.title && parseInt(evt.startDate) === parseInt(event.startDate)){
				return true;
			}
		}
		return false;
	},

	/* createEventList(url)
	 * Requests node helper to add calendar url.
	 *
	 * argument url string - Url to add.
	 */
	addCalendar: function (url, auth, calendarConfig) {
		this.sendSocketNotification("ADD_CALENDAR", {
			url: url,
			excludedEvents: calendarConfig.excludedEvents || this.config.excludedEvents,
			maximumEntries: calendarConfig.maximumEntries || this.config.maximumEntries,
			maximumNumberOfDays: calendarConfig.maximumNumberOfDays || this.config.maximumNumberOfDays,
			fetchInterval: this.config.fetchInterval,
			symbolClass: calendarConfig.symbolClass,
			titleClass: calendarConfig.titleClass,
			timeClass: calendarConfig.timeClass,
			auth: auth,
			broadcastPastEvents: calendarConfig.broadcastPastEvents || this.config.broadcastPastEvents,
		});
	},

	/**
	 * symbolsForUrl(url)
	 * Retrieves the symbols for a specific url.
	 *
	 * argument url string - Url to look for.
	 *
	 * return string/array - The Symbols
	 */
	symbolsForUrl: function (url) {
		return this.getCalendarProperty(url, "symbol", this.config.defaultSymbol);
	},

	/**
	 * symbolClassForUrl(url)
	 * Retrieves the symbolClass for a specific url.
	 *
	 * @param url string - Url to look for.
	 *
	 * @returns string
	 */
	symbolClassForUrl: function (url) {
		return this.getCalendarProperty(url, "symbolClass", "");
	},

	/**
	 * titleClassForUrl(url)
	 * Retrieves the titleClass for a specific url.
	 *
	 * @param url string - Url to look for.
	 *
	 * @returns string
	 */
	titleClassForUrl: function (url) {
		return this.getCalendarProperty(url, "titleClass", "");
	},

	/**
	 * timeClassForUrl(url)
	 * Retrieves the timeClass for a specific url.
	 *
	 * @param url string - Url to look for.
	 *
	 * @returns string
	 */
	timeClassForUrl: function (url) {
		return this.getCalendarProperty(url, "timeClass", "");
	},

	/* calendarNameForUrl(url)
	 * Retrieves the calendar name for a specific url.
	 *
	 * argument url string - Url to look for.
	 *
	 * return string - The name of the calendar
	 */
	calendarNameForUrl: function (url) {
		return this.getCalendarProperty(url, "name", "");
	},

	/* colorForUrl(url)
	 * Retrieves the color for a specific url.
	 *
	 * argument url string - Url to look for.
	 *
	 * return string - The Color
	 */
	colorForUrl: function (url) {
		return this.getCalendarProperty(url, "color", "#fff");
	},

	/* countTitleForUrl(url)
	 * Retrieves the name for a specific url.
	 *
	 * argument url string - Url to look for.
	 *
	 * return string - The Symbol
	 */
	countTitleForUrl: function (url) {
		return this.getCalendarProperty(url, "repeatingCountTitle", this.config.defaultRepeatingCountTitle);
	},

	/* getCalendarProperty(url, property, defaultValue)
	 * Helper method to retrieve the property for a specific url.
	 *
	 * argument url string - Url to look for.
	 * argument property string - Property to look for.
	 * argument defaultValue string - Value if property is not found.
	 *
	 * return string - The Property
	 */
	getCalendarProperty: function (url, property, defaultValue) {
		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			if (calendar.url === url && calendar.hasOwnProperty(property)) {
				return calendar[property];
			}
		}

		return defaultValue;
	},

	/**
	 * Shortens a string if it's longer than maxLength and add a ellipsis to the end
	 *
	 * @param {string} string Text string to shorten
	 * @param {number} maxLength The max length of the string
	 * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
	 * @param {number} maxTitleLines The max number of vertical lines before cutting event title
	 * @returns {string} The shortened string
	 */
	shorten: function (string, maxLength, wrapEvents, maxTitleLines) {
		if (typeof string !== "string") {
			return "";
		}

		if (wrapEvents === true) {
			var temp = "";
			var currentLine = "";
			var words = string.split(" ");
			var line = 0;

			for (var i = 0; i < words.length; i++) {
				var word = words[i];
				if (currentLine.length + word.length < (typeof maxLength === "number" ? maxLength : 25) - 1) { // max - 1 to account for a space
					currentLine += (word + " ");
				} else {
					line++;
					if (line > maxTitleLines - 1) {
						if (i < words.length) {
							currentLine += "&hellip;";
						}
						break;
					}

					if (currentLine.length > 0) {
						temp += (currentLine + "<br>" + word + " ");
					} else {
						temp += (word + "<br>");
					}
					currentLine = "";
				}
			}

			return (temp + currentLine).trim();
		} else {
			if (maxLength && typeof maxLength === "number" && string.length > maxLength) {
				return string.trim().slice(0, maxLength) + "&hellip;";
			} else {
				return string.trim();
			}
		}
	},

	/* capFirst(string)
	 * Capitalize the first letter of a string
	 * Return capitalized string
	 */
	capFirst: function (string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	},

	/* titleTransform(title)
	 * Transforms the title of an event for usage.
	 * Replaces parts of the text as defined in config.titleReplace.
	 * Shortens title based on config.maxTitleLength and config.wrapEvents
	 *
	 * argument title string - The title to transform.
	 *
	 * return string - The transformed title.
	 */
	titleTransform: function (title) {
		for (var needle in this.config.titleReplace) {
			var replacement = this.config.titleReplace[needle];

			var regParts = needle.match(/^\/(.+)\/([gim]*)$/);
			if (regParts) {
			  // the parsed pattern is a regexp.
			  needle = new RegExp(regParts[1], regParts[2]);
			}

			title = title.replace(needle, replacement);
		}

		title = this.shorten(title, this.config.maxTitleLength, this.config.wrapEvents, this.config.maxTitleLines);
		return title;
	},

	/* broadcastEvents()
	 * Broadcasts the events to all other modules for reuse.
	 * The all events available in one array, sorted on startdate.
	 */
	broadcastEvents: function () {
		var eventList = [];
		for (var url in this.calendarData) {
			var calendar = this.calendarData[url];
			for (var e in calendar) {
				var event = cloneObject(calendar[e]);
				event.symbol = this.symbolsForUrl(url);
				event.calendarName = this.calendarNameForUrl(url);
				event.color = this.colorForUrl(url);
				delete event.url;
				eventList.push(event);
			}
		}

		eventList.sort(function(a,b) {
			return a.startDate - b.startDate;
		});

		this.sendNotification("CALENDAR_EVENTS", eventList);

	}
});
