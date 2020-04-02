import clone from 'clone';
import deepmerge from 'deepmerge';
import Logger from './Logger';
import Twilio from 'twilio';

import storage from './storage';

const logger = new Logger('settingsManager');

const DEFAULT_SIP_DOMAIN = 'InstantVoice';
const DEFAULT_SETTINGS =
{
	'display_name' : null,
	uri            : null,
	password       : null,
	socket         :
		{
			uri             : 'wss://dev05.instant.com.br/ws',
			'via_transport' : 'auto'
		},
	'registrar_server'    : null,
	'contact_uri'         : null,
	'authorization_user'  : null,
	'instance_id'         : null,
	'session_timers'      : true,
	'use_preloaded_route' : false,
	pcConfig              :
	{
		rtcpMuxPolicy : 'negotiate',
		iceServers    :
		[
			{
				urls       : [ 'turn:global.turn.twilio.com:3478?transport=udp' ],
				username   : '',
				credential : ''
			},
			{
				urls       : [ 'turn:global.turn.twilio.com:443?transport=tcp' ],
				username   : '',
				credential : ''
			}
		]
	},
	callstats :
		{
			enabled   : false,
			AppID     : null,
			AppSecret : null
		}
};

let settings;

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const client = Twilio(accountSid, authToken);
const turnPorts = process.env.TURN_PORTS.split(';');

// First, read settings from local storage
settings = storage.get();

if (settings) 
{
	logger.debug('settings found in local storage');
}

function parseTwilioUrl(url)
{
	let port = '',
		protocol = '';

	port = url.split(':')[2];
	[ port, protocol ] = port.split('?');

	return [ port, protocol.replace('transport=', '') ];
}

function formatPortProtocol(port, protocol)
{
	return `${port}/${protocol.toUpperCase()}`;
}

// Try to read settings from a global SETTINGS object
if (window.SETTINGS)
{

	settings = deepmerge(
		window.SETTINGS,
		settings || {},
		{ arrayMerge: (destinationArray, sourceArray) => sourceArray });

	client.tokens.create().then((token) =>
	{
		const servers = token.iceServers.filter((server) =>
		{
			return server.url.startsWith('turn:') && turnPorts.includes(formatPortProtocol(...parseTwilioUrl(server.url)));
		});

		settings.pcConfig.iceServers = servers.map((server) =>
		{
			return {
				urls       : [ server.url ],
				username   : server.username,
				credential : server.credential
			};
		});

	});

}

// If not settings are found, clone default ones
if (!settings)
{
	logger.debug('no settings found, using default ones');

	settings = clone(DEFAULT_SETTINGS, false);
}

module.exports =
{
	get()
	{
		return settings;
	},

	set(newSettings)
	{
		storage.set(newSettings);
		settings = newSettings;
	},

	clear()
	{
		storage.clear();
		settings = clone(DEFAULT_SETTINGS, false);
		client.tokens.create().then((token) =>
		{
			const servers = token.iceServers.filter((server) =>
			{
				return server.url.startsWith('turn:') && turnPorts.includes(formatPortProtocol(...parseTwilioUrl(server.url)));
			});

			settings.pcConfig.iceServers = servers.map((server) =>
			{
				return {
					urls       : [ server.url ],
					username   : server.username,
					credential : server.credential
				};
			});

		});
	},

	isReady()
	{
		return Boolean(settings.uri);
	},

	getDefaultDomain()
	{
		return DEFAULT_SIP_DOMAIN;
	}
};
