<div align="center">
  <h2>NLC 💾</h2>
  <p>A terminal assistant for natural language commands.</p>
  <a href="https://npmjs.com/package/nlc"><strong>npm</strong></a> | <a href="https://buymeacoffee.com/remvze">Buy Me a Coffee</a>
</div>

## Table of Contents

- ⚠️ [Prerequisites](#prerequisites)
- ⚡ [Installation](#installation)
- ✨ [Usage](#usage)
- 🔮 [Commands](#commands)
- 🤝 [Contributing](#contributing)
- ⭐ [Support](#support)
- 📜 [License](#license)

## Prerequisites

- **Node.js** and **npm** must be installed on your system. You can download them from [nodejs.org](https://nodejs.org).
- You must have a valid **OpenAI API key** to use NLC. You can get one from [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys).

## Installation

To install NLC, you need Node.js and npm installed on your machine. You can install the CLI tool globally using the following command:

```bash
npm install -g nlc
```

## Usage

After installation, you can run the CLI tool using the following command:

```bash
nlc [command] [options]
```

To see a list of available commands and options, run:

```bash
nlc --help
```

## Commands

### `do`

Execute a natural language request using NLC.

```bash
nlc do "list all the Docker containers"
nlc do "write me a port scanner in Bash"
```

**Options:**

- `--file`: Optional file to include with your request (e.g., for context or input data).

### `config`

Manage configuration settings for NLC.

```bash
nlc config key <your_openai_api_key>
nlc config model "gpt-4o-mini"
```

## Contributing

We welcome contributions from the community! If you'd like to contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Make your changes and commit them with a descriptive commit message.
4. Push your changes to your fork.
5. Open a pull request with a detailed description of your changes.

## Support

If you find this project useful, please consider supporting it by giving it a star on GitHub. Your support helps us continue to improve and maintain the project.

You can also support the project by [making a donation](https://buymeacoffee.com/remvze). Every little bit helps and is greatly appreciated!

Thank you for your support!

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

Thank you for using NLC! If you have any questions or feedback, please open an issue on GitHub.
