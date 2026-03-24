// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Website loaded! Kamehameha! 🐉');
    
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // CTA button animation
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', function() {
            // Add animation class
            this.classList.add('clicked');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                this.classList.remove('clicked');
            }, 300);
            
            // Scroll to projects section
            const projectsSection = document.querySelector('#projects');
            if (projectsSection) {
                window.scrollTo({
                    top: projectsSection.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
            
            // Show alert (for demo purposes)
            setTimeout(() => {
                alert("Kamehameha! Let's start coding! 💪");
            }, 500);
        });
    }
    
    // Add hover effect to project cards
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.boxShadow = '0 10px 25px rgba(255, 107, 107, 0.3)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
        });
    });
    
    // Dragon ball animation control
    const dragonBall = document.querySelector('.dragon-ball');
    if (dragonBall) {
        dragonBall.addEventListener('click', function() {
            this.style.animation = 'none';
            this.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                this.style.animation = 'float 3s ease-in-out infinite';
                this.style.transform = 'scale(1)';
            }, 300);
        });
    }
    
    // Add current year to footer
    const currentYear = new Date().getFullYear();
    const footer = document.querySelector('footer');
    if (footer) {
        const yearElement = document.createElement('p');
        yearElement.textContent = `© ${currentYear} Goku's Training Ground`;
        yearElement.style.marginTop = '1rem';
        yearElement.style.fontSize = '0.9rem';
        yearElement.style.opacity = '0.8';
        footer.insertBefore(yearElement, footer.querySelector('.social'));
    }
    
    // Console greeting
    console.log('%c🐉 Kamehameha! Welcome to Goku\'s Website!', 
        'color: #ff6b6b; font-size: 16px; font-weight: bold;');
    console.log('%cThis website was created with HTML, CSS, and JavaScript!', 
        'color: #4a6491; font-size: 14px;');
});

// Add CSS for button animation
const style = document.createElement('style');
style.textContent = `
    .cta-button.clicked {
        animation: pulse 0.3s ease;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(0.95); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);