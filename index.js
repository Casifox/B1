const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 5000;

// Middleware pour les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pdfs', express.static(path.join(__dirname, 'uploads')));

// Middleware pour parser le corps des requêtes POST
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware pour gérer les sessions
app.use(session({
    secret: 'secret_session_key',
    resave: false,
    saveUninitialized: false
}));

// Configuration Multer pour les téléchargements de PDF
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

// Route pour gérer les téléchargements de fichiers PDF
app.post('/upload', upload.array('pdfFiles'), (req, res) => {
    // Informer les clients qu'un ou plusieurs nouveaux fichiers ont été ajoutés
    const uploadedFiles = req.files.map(file => file.originalname);
    io.emit('filesAdded', uploadedFiles);
    res.redirect('/');
});

// Route pour gérer la suppression de fichiers
app.delete('/delete/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'uploads', fileName);

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Erreur lors de la suppression du fichier :', err);
            res.status(500).send('Erreur lors de la suppression du fichier');
            return;
        }
        io.emit('fileDeleted', fileName);
        res.sendStatus(200);
    });
});

// Gestion de la connexion Socket.IO
io.on('connection', (socket) => {
    console.log('Client connecté');

    socket.on('disconnect', () => {
        console.log('Client déconnecté');
    });

    socket.on('getFiles', () => {
        fs.readdir(path.join(__dirname, 'uploads'), (err, files) => {
            if (err) {
                console.error(err);
                return;
            }
            io.emit('files', files);
        });
    });
});

// Route pour la page de connexion
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route pour traiter la soumission du formulaire de connexion
// Route pour traiter la soumission du formulaire de connexion
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Utilisateurs préconfigurés (à remplacer par une base de données dans un environnement réel)
    const users = [
        { username: 'Patron', password: 'B1@71' },
        { username: 'Employe', password: 'magasin' }
    ];

    // Vérifier les informations d'identification
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        // Authentification réussie, rediriger selon le type d'utilisateur
        req.session.isAuthenticated = true;
        req.session.username = user.username;

        if (user.username === 'Employe') {
            res.redirect('/loginemploye.html'); // Rediriger l'employé vers loginemploye.html
        } else {
            res.redirect('/dashboard'); // Rediriger le patron vers le tableau de bord sécurisé
        }
    } else {
        // Authentification échouée, rediriger vers la page de connexion avec un message d'erreur
        res.redirect('/login');
    }
});


// Middleware pour vérifier l'authentification avant d'accéder à certaines routes
function requireAuth(req, res, next) {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.status(401).send('Vous devez être connecté pour accéder à cette ressource');
    }
}

// Route sécurisée pour accéder à un tableau de bord ou une page protégée
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Redirection automatique vers la page de connexion pour toute autre URL
app.get('*', (req, res) => {
    res.redirect('/login');
});

// Démarrage du serveur
server.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
