# homebridge-actronair-neo

Use this plugin to control your ActronAir Neo system with Apple HomeKit using Homebridge.

## Current Status
---

This is an 'almost' feature complete implementation of the Neo platform in HomeKit

 - Control either a single zone or multi-zone system
 - Master controller and each zone sensor will be exposed as unique, controllable accessory in HomeKit
 - Get temp and humidity data from all zones and master controller reported in HomeKit
 - Get temp data from outdoor unit as a separate accessory
 - Report battery level on zone sensors and get low battery alerts in the home app
 - Support for homebridge config UI

## Controlling Zone Temperature Settings
---
When modifying the zone temperature settings, the Neo system only allows you to set a temperature that is within -2 degrees (Heating) or +2 degrees (Cooling) of the Master Control temperature. With version 1.1.0 I have modified the default behaviour to automatically adjust the master temp if required when modifying a zone temp.
Setting `zonesPushMaster` to false will revert to the prior behaviour of constraining zones to the allowable max/min based on the current master setting. If you set a zone temperature that is outside of the +/- 2 degree range from the master the plugin will translate the set temp to the allowable range.


## Installation
---
### GUI Install
1. Search for "ActronAir Neo" on the plugin screen of Homebridge Config UI X
2. Find: homebridge-actronair-neo
3. Click Install
4. Enter your account details in the settings screen displayed

### CLI Install
```
npm install -g homebridge-actronair-neo
```
Configure account details in the homebridge `config.json` file a below.
## Configuration
---
The plugin implements the Homebridge config UI service. Simply install the plugin and you will be guided through the setup.

If you are not using the Homebridge config UI you can add the following to your homebridge configuration

```
    "platforms": [
        {
            "platform": "ActronNeo",
            "name": "ActronNeo",
            "username": "<your_username>",
            "password": "<your_password>",
            "clientName": "homebridgeNeo",
            "zonesFollowMaster": true | false,
            "zonesPushMaster": true | false,
            "refreshInterval": 60,
            "deviceSerial": "",
            "maxCoolingTemp": 32,
            "minCoolingTemp": 20,
            "maxHeatingTemp": 26,
            "minHeatingTemp": 10,
        }]
```

#### `platform`
type: string

default: "ActronNeo"

This is the name of the platform plugin you are configuring. This should always be set to the default value.

#### `name`
type: string

default: "ActronNeo"

This is the name used for the instance of the plugin you are running. The default of "ActronNeo" can be used in most cases

#### `username`
type: string

The username you use to login to the ActronAir Neo app on your phone, or at nimbus.actronair.com.au

default: 60
#### `password`
type: string

The password you use to login to the ActronAir Neo app on your phone, or at nimbus.actronair.com.au

default: 60
#### `clientName`
type: string

default: "homebridge-actronair-neo"

The value you set for client name will be used in two places:
1. It will set this as the default accessory name for the master controller when pairing the accessory in HomeKit.
2. It will appear as the client name in the 'Authorised Devices' list on the Neo cloud service.

#### `refreshinterval`

type: number

Unit: seconds

default: 60

The plugin will periodically poll the Neo API to update the locally cached settings in the plugin. This allows us to keep HomeKit up-to-date with changes made through other control methods (i.e. the wall controller or the Neo mobile app). The default is 60 seconds but can be adjusted to suit your preference.

#### `zonesFollowMaster`

type: boolean 

default: true

Setting this to true will make it so that any changes to the master controller temperature setting in HomeKit will ALWAYS be propagated to all zones. This is akin to toggling the 'Control All Zones' option on the Master Controller or in the Neo mobile app.

#### `zonesPushMaster`

type: boolean 

default: true

Setting this to true will make it so that changes to the zone temperature setting in HomeKit will push the master unit threshold temps for heat and cool if required. There is a +/- 2 degree variation permitted between the master temp and zone temps. Normally the Neo native controls will restrict you to this temp range unless you manually adjust the master temp first. This option simply pushes the master temp to a new setting if you set the zone outside of the variance. Setting this to true has greatly increased my family's satisfaction with the controls.

#### `deviceSerial`

type: string (lowercase)

default: ""

In most cases you can exclude this option or leave it blank. If you only have a single air con system in your Neo account the plugin will auto-discover the target device serial number. If you have multiple Neo systems in your account you will need to specify which system you want to control by entering the serial number here. You can get your device serial numbers by logging in to nimbus.actronair.com.au and looking at the list of authorised devices.

#### `maxCoolingTemp`

type: number

Unit: celsius

default: 32

Highest temp that the cooling mode can be set. Refer to you Neo system settings for the correct value.
This setting is optional and only needs to be set if the defaults do not align with your system configuration.

#### `minCoolingTemp`

type: number

Unit: celsius

default: 20

Lowest temp that the cooling mode can be set. Refer to you Neo system settings for the correct value.
This setting is optional and only needs to be set if the defaults do not align with your system configuration.

#### `maxHeatingTemp`

type: number

Unit: celsius

default: 26

Highest temp that the heating mode can be set. Refer to you Neo system settings for the correct value.
This setting is optional and only needs to be set if the defaults do not align with your system configuration.

#### `minHeatingTemp`

type: number

Unit: celsius

default: 10

Lowest temp that the heating mode can be set. Refer to you Neo system settings for the correct value.
This setting is optional and only needs to be set if the defaults do not align with your system configuration.
### HTTP Error Handling

The plugin has been designed to manage the following HTTP error states

#### Error 400
---
The Neo API returns a 400 status code when you attempt to authenticate with an invalid username or password. In this case you will see an Error logged to the Homebridge log suggesting that you check the username and password provided.  
The error will also let you know that a restart may help if you recently revoked the client access through the Neo online portal. The reason the restart will help is because following this error the persistent storage of auth tokens is flushed in case there was an issue with the cached data.

`Looks like you have a username or password issue, check your config file: http status code = 400`  
`If you recently revoked access for clients on the Neo portal, a restart should resolve the issue`

#### Error 401
---
If an invalid or expired bearer token is presented in a request to the Neo API the server will respond with a 401 ('Unauthorised') status code. In this case, the plugin will automatically request a new bearer token, update the request and retry.
The plugin is configured to retry a maximum of three times with a pause of three seconds between requests. If the maximum number of retires is exceeded you will see the following Error logged to the Homebridge log file.  
The error will also let you know that a restart may help if you recently revoked the client access through the Neo online portal. The reason the restart will help is because following this error the persistent storage of auth tokens is flushed in case there was an issue with the cached data.

`Maximum retires exceed on failed Authorisation: http status code = 401`  
`If you recently revoked access for clients on the Neo portal, a restart should resolve the issue`

#### Error 5xx
---
During development of the plugin I noticed that the Neo API occasionally fails to service a request from its backend and responds with a 504 (i think this is what causes the Neo iPhone app to be particularity awful to use). Waiting a second or two and retrying seems to reliably allow you to move past the error and carry on. I also noted that on occasion the Neo service will misbehave and return a range of 5xx errors (primarily 504 and 503). For this reason the plugin will retry three times on a 5xx status with a wait time of three seconds between retries. If the maximum number of retires is exceeded you will see the following Info message logged to the Homebridge log file.

`Maximum retries exceeded -> Actron Neo API returned a server side error: http status code = 5xx`

Generally these errors will resolve after time and things will keep on running. From version 1.1.0 this error handling was improved to prevent the plugin terminating and allow for a graceful recovery once the Neo API starts responding normally again.

#### All other non-200
---
All other errors will fall through to a default handler that will return the following Error in the Homebridge log. As before, persistent auth data will be flushed to allow for a clean restart.

`An unhandled error has occurred: http status code = <status code>`  
`If you recently revoked access for clients on the Neo portal, a restart may resolve the issue`

### Network Outages
Beginning with version 1.1.0 the plugin will now gracefully recover from network outages. The network MUST be available on startup, but if there is an outage during operation you will see the following Info message in the log and the plugin will resume functioning once the network is restored. 

`Cannot reach Neo cloud service, check your network connection <specific error condition>`

### Master Controller Offline
Beginning with 1.2.3 the plugin will now detect if your master controller is disconnected from the network or otherwise unable to reach the QNeoue Cloud Service. You will be alerted to this via the following log message:

`Master Controller is offline. Check Master Controller Internet/Wifi connection`

And / Or:

`Master Controller is offline. Check Master Controller Internet/Wifi connection`  
`Refreshing HomeKit accessory state using cached data`
### Schema Validation Errors
Beginning with version 1.2.3 the plugin will now gracefully recover when the API returns data that does not meet the schema validation requirements. This has been implemented as it was observed that the API will at times return a valid HTTP response, but the JSON payload contains incomplete data (I assume that this is a resource scaling issue on Actron's end). 

`API Returned Bad Data - Schema Validation Failed`

### State Refresh from Cache on Error
If errors occur during the periodic state refresh interval (poll to Actron cloud to ensure Homebridge has up to date device data) then you may see one or both of the following warning messages appear in the event log. This is simply to make you aware that the Actron cloud service is returning bad or error data however cached info will be used for the state refresh to allow operation to continue gracefully. From experience I have observed that the Actron service will experience issues most days and may return bad data for up to 10mins before returning to reliable operation. I am working on a project to start logging the availability of their cloud service so i can provide information to their support team to hopefully resolve these on-going issues.

`Failed to refresh status, Actron Neo Cloud unreachable or returned invalid data`  
`Actron Neo cloud error, refreshing HomeKit accessory state using cached data`
