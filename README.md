# homebridge-actronair-neo

[![npm version](https://badge.fury.io/js/homebridge-actronair-neo.svg)](https://badge.fury.io/js/homebridge-actronair-neo)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Control your ActronAir Neo system with Apple HomeKit using Homebridge.

## Table of Contents

- [Current Status](#current-status)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Controlling Zone Temperature Settings](#controlling-zone-temperature-settings)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Current Status

This is an 'almost' feature complete implementation of the Neo platform in HomeKit.

## Features

- Control either a single zone or multi-zone system
- Master controller and each zone sensor exposed as unique, controllable accessories in HomeKit
- Temperature and humidity data from all zones and master controller reported in HomeKit
- Temperature data from outdoor unit as a separate accessory
- Battery level reporting on zone sensors with low battery alerts in the Home app
- Support for Homebridge Config UI X

## Installation

### GUI Install
1. Search for "ActronAir Neo" on the plugin screen of Homebridge Config UI X
2. Find: homebridge-actronair-neo
3. Click Install
4. Enter your account details in the settings screen displayed

### CLI Install
```
npm install -g homebridge-actronair-neo
```
Configure account details in the homebridge `config.json` file as below.

## Configuration

The plugin implements the Homebridge config UI service. Simply install the plugin and you will be guided through the setup.

If you are not using the Homebridge config UI, you can add the following to your homebridge configuration:

```json
"platforms": [
    {
        "platform": "ActronNeo",
        "name": "ActronNeo",
        "username": "<your_username>",
        "password": "<your_password>",
        "clientName": "homebridgeNeo",
        "zonesFollowMaster": true,
        "zonesPushMaster": true,
        "refreshInterval": 60,
        "deviceSerial": "",
        "maxCoolingTemp": 32,
        "minCoolingTemp": 20,
        "maxHeatingTemp": 26,
        "minHeatingTemp": 10,
    }
]
```

[Your existing detailed configuration options here]

## Controlling Zone Temperature Settings

When modifying the zone temperature settings, the Neo system only allows you to set a temperature that is within -2 degrees (Heating) or +2 degrees (Cooling) of the Master Control temperature. With version 1.1.0, the default behaviour has been modified to automatically adjust the master temp if required when modifying a zone temp.

Setting `zonesPushMaster` to false will revert to the prior behaviour of constraining zones to the allowable max/min based on the current master setting. If you set a zone temperature that is outside of the +/- 2 degree range from the master, the plugin will translate the set temp to the allowable range.

## Error Handling

[Your existing error handling information here]

## Troubleshooting

Here are some common issues and their solutions:

1. **HTTP Error 400**: Check your username and password in the configuration. If you recently revoked client access through the Neo online portal, try restarting Homebridge.

2. **HTTP Error 401**: The plugin will automatically request a new bearer token. If the issue persists after multiple retries, try restarting Homebridge.

3. **HTTP Error 5xx**: These are server-side errors from the Neo API. The plugin will retry a few times. If the issue persists, it's likely a temporary problem with the Neo service.

4. **Network Outages**: The plugin will attempt to gracefully recover from network outages. Ensure your network connection is stable.

5. **Master Controller Offline**: Check your Master Controller's internet/WiFi connection if you see a message about it being offline.

6. **Schema Validation Errors**: These occur when the API returns incomplete data. The plugin will attempt to continue operation using cached data.

For more detailed information on error handling, please refer to the [Error Handling](#error-handling) section.

## Contributing

Contributions to this plugin are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes and commit them with a clear commit message
4. Push your changes to your fork
5. Submit a pull request

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have feature requests, please [open an issue](https://github.com/domalab/homebridge-actronair-neo/issues) on GitHub.