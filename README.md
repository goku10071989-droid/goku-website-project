# Goku's Website Project 🐉

A responsive website project created to practice web development skills.

## Features

- **Responsive Design**: Works on all device sizes
- **Modern UI**: Clean and colorful interface with animations
- **Interactive Elements**: JavaScript for enhanced user experience
- **Smooth Navigation**: Smooth scrolling between sections
- **Dragon Ball Theme**: Fun Dragon Ball Z inspired elements

## Project Structure

```
website-project/
├── index.html          # Main HTML file
├── style.css           # Stylesheet
├── script.js           # JavaScript file
└── README.md           # This file
```

## Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with flexbox, grid, and animations
- **JavaScript**: Interactive functionality
- **Font Awesome**: Icon library

## Getting Started

1. Clone or download this project
2. Open `index.html` in your web browser
3. No build process or dependencies required!

## How to Use

- Click navigation links to smoothly scroll to sections
- Click the "Let's Train!" button for a fun animation
- Click the dragon ball for a bounce effect
- Hover over project cards for elevation effect

## Browser Support

Works on all modern browsers:
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## Future Enhancements

1. Add more interactive features
2. Implement a backend with Node.js
3. Add user authentication
4. Create a blog section
5. Add dark mode toggle

## Authentication (Google Sign-In)

This project includes a client-side integration for "Sign in with Google" using Google Identity Services.

Setup:

1. Create a Google OAuth Client ID in the Google Cloud Console (Web application). Set the authorized JavaScript origins to the URL where you'll serve the site (e.g., `http://localhost:8000`).
2. Open `script.js` and replace `REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID` with your Client ID.
3. Serve the site over a local static server for best results.

Quick test commands:

```bash
# using Python 3
python -m http.server 8000

# or using npm http-server
npx http-server -c-1
```

Then open `http://localhost:8000` in your browser and click the "Sign in with Google" button. The demo callback logs the ID token to the console. For production use, verify the token server-side.

## Credits

Created by **Goku** 🐉 with guidance from **Mr Kame**

Inspired by Dragon Ball Z and the spirit of continuous improvement!

## License

This project is open source and available for learning purposes.

---

**Kamehameha!** 💥 Keep training and coding!