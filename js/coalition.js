// Check for outdated browsers.
(function() {
    var isIE = navigator.userAgent.match(/MSIE (\d+)\./);
    if (isIE) {
        var version = +isIE[1];
        if (version < 10) {
            alert('Unfortunately your browser, Internet Explorer ' + version + ', is not supported.\nPlease visit the site with a modern browser like Firefox or Chrome.\nThanks!');
        }
    }

    if (navigator.userAgent.match(/Android 2\.3/)) {
        alert('Unfortunately your browser, Android 2.3, is not supported.\nPlease visit the site with a modern browser like Firefox or Chrome.\nThanks!');
    }
})();



// Setup shortcuts for AJAX.
var ajax = {
    get: function(url, callback) {
        callback = callback || function() {};

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                callback(xhr.response);
            }
        };
        xhr.open('get', url, true);
        xhr.send();
    },

    post: function(url, formData, callback) {
        callback = callback || function() {};

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                callback(xhr.response);
            }
        };
        xhr.open('post', url, true);
        xhr.send(formData);
    },
};



// Application globals.
var state = {
    aModalIsShowing: false,
    category: null,
    email: '',
    isMobile: /mobile/i.test(navigator.userAgent),
    joinStep: 1,
    showingModals: {},
};
var packery;



// Start application.
(function() {
    setupHeroForm();

    updateArtistsCount();

    prepareOverlays();
    setupCategoriesModal();
    setupJoinModal();

    loadArtistsFromDB({
        category: state.category,
        page: 1,
        size: 16,
    });

    respondToResizes();

    if (state.isMobile) {
        document.body.classList.add('mobile');
    }
})();



function updateArtistsCount() {
    ajax.get('https://coalition-api.herokuapp.com/artists/count', function(count) {
        document.getElementById('artists-count').textContent = count;
    });
}



var artistTemplate = _.template(document.getElementById('template:artist').innerHTML);
function loadArtistsFromDB(params) {
    var view = document.getElementById('artists-view');

    if (!packery) {
        packery = new Packery(view, {
            itemSelector: '.artist',
            gutter: 10
        });
        packery.unbindResize();
    }

    var url =
        'https://coalition-api.herokuapp.com/artists/' +
        params.size + '/' +
        params.page + '/' +
        (params.category || '');

    ajax.get(url, function(res) {
        var artistsData = JSON.parse(res);

        var element;
        var elements = [];
        var container = document.createElement('div');
        var fragment = document.createDocumentFragment();
        _.each(artistsData, function(artistData) {
            container.innerHTML = artistTemplate(artistData);
            element = container.firstElementChild
            elements.push(element);
            fragment.appendChild(element);
        });

        packery.remove(packery.getItemElements());

        view.appendChild(fragment);
        packery.appended(elements);

        packery.layout(); // Packery bug fix.

        if (elements.length === 0) {
            view.classList.add('nothing');
        } else {
            view.classList.remove('nothing');
        }
    });
}

function setupHeroForm() {
    var emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    document.getElementById('hero-form').addEventListener('submit', function(e) {
        e.preventDefault();

        var tag = 'artistscoalition';

        var data = new FormData();
        data.append('guard', '');
        data.append('hp_enabled', true);
        data.append('tag', tag);
        data.append('org', 'fftf');

        var emailElement = document.getElementById('hero-form-email');
        var email = emailElement.value.trim();
        if (!email || !emailRegex.test(email)) {
            alert('Please enter an email address.');
            return emailElement.focus();
        }

        state.email = email;

        data.append('member[email]', email);

        ajax.post('https://queue.fightforthefuture.org/action', data);

        document.activeElement.blur();
        document.querySelector('header .email').classList.add('thanks');
    });
}

function setupCategoriesModal() {
    var categoriesOptions = document.getElementById('categories-modal-options');
    var categoriesButton = document.getElementById('categories-modal-button');

    categoriesButton.addEventListener('click', function(e) {
        modalShow('categories-modal');
    }, false);

    categoriesOptions.addEventListener('click', function(e) {
        if (!e.target.classList.contains('option')) return;
        
        var id = e.target.getAttribute('data-id');
        var name = e.target.textContent.trim();

        if (id === '0') {
            id = false;
        }

        state.category = id;
        document.getElementById('selected-category-name').textContent = name;

        modalHide('categories-modal');

        loadArtistsFromDB({
            category: state.category,
            page: 1,
            size: 16,
        });
    }, false);

    // Populate categories.
    ajax.get('https://coalition-api.herokuapp.com/categories', function(res) {
        var categories = JSON.parse(res);
        categories.unshift({
            id: 0,
            name: "All",
        });

        var template = _.template(document.getElementById('template:categories').innerHTML);
        var html = template({ categories: categories });
        categoriesOptions.innerHTML = html;
    });
}

function setupJoinModal() {
    var joinButtons = document.querySelectorAll('button.add-your-name');

    _.each(joinButtons, function(joinButton) {
        joinButton.addEventListener('click', function(e) {
            e.preventDefault();

            state.step = 1;
            updateJoinModalStep();

            modalShow('join-modal');
        }, false);
    });

    document.querySelector('#join-modal button.n').addEventListener('click', function(e) {
        e.preventDefault();

        if (state.step === 1) {
            modalHide('join-modal');
            return;
        }

        state.step--;
        updateJoinModalStep();
    }, false);

    document.querySelector('#join-modal button.y').addEventListener('click', function(e) {
        e.preventDefault();

        if (state.step === 4) {
            console.log('TODO: Submit form!');
            modalHide('join-modal');
            return;
        }

        state.step++;
        updateJoinModalStep();
    }, false);

    var uploadButton = document.getElementById('upload-a-photo');
    uploadButton.querySelector('input').addEventListener('change', onImageChange, false);
}

function onImageChange() {
    if (!this.files || !this.files[0]) {
        return;
    }

    var uploadButton = document.getElementById('upload-a-photo');

    file = this.files[0];
    var reader = new FileReader();

    var previewImg = document.getElementById('uploaded-photo-preview');
    reader.onloadend = function() {
        if (file.type === 'image/png' || file.type === 'image/jpeg') {
            var image = new Image();
            image.src = reader.result;
            image.onload = function() {
                console.log('YAY!');
                console.log(image.width);
                console.log(image.height);

                console.log('reader.result: ' + reader.result);
                previewImg.style.backgroundImage = 'url(' + reader.result + ')';
                previewImg.style.display = 'block';
            }
        } else {
            previewImg.style.display = 'none';
            file = false;
        }

        if (file) {
            uploadButton.classList.add('selected');
        } else {
            uploadButton.classList.remove('selected');
        }

        console.log('File detected!!'); // TODO: Remove this debug code.
        console.log((file.size / 1024).toFixed(2) + ' kb'); // TODO: Remove this debug code.
        console.log(file.type); // TODO: Remove this debug code.
        console.log('Width =', previewImg.width); // TODO: Remove this debug code.
        console.log('Height =', previewImg.height); // TODO: Remove this debug code.
        console.log('---'); // TODO: Remove this debug code.
    }

    reader.readAsDataURL(file);
}

var buttonLabels = {
    n: [
        'Cancel',
        'Back',
        'Back',
        'Back',
    ],

    y: [
        'Next',
        'Next',
        'Finalize',
        'Submit',
    ],
};

function updateJoinModalStep() {
    // Update path labels.
    var labels = document.querySelectorAll('#join-modal .path .step');
    _.each(labels, function(label, i) {
        if (state.step === i + 1) {
            label.classList.add('selected');
        } else {
            label.classList.remove('selected');
        }
    });

    // Update button labels.
    document.querySelector('#join-modal .buttons button.n').textContent = buttonLabels.n[state.step - 1];
    document.querySelector('#join-modal .buttons button.y').textContent = buttonLabels.y[state.step - 1];

    // Show & hide forms.
    var forms = document.querySelectorAll('#join-modal form .step');
    _.each(forms, function(form, i) {
        if (state.step === i + 1) {
            form.style.display = 'block';
        } else {
            form.style.display = 'none';
        }
    });
}

function respondToResizes() {
    var artistsContainer = document.getElementById('artists-section');
    var artistsView = document.getElementById('artists-view');

    var onResize = _.throttle(function(e) {
        var padding = 32;
        var potentialWidth = artistsContainer.clientWidth - padding;
        var gutterSize = 10;
        var elementWidth = 217;

        var estimatedNumberOfElements = Math.floor(potentialWidth / elementWidth);
        var remainingWidth = potentialWidth % elementWidth;

        if (remainingWidth < (estimatedNumberOfElements - 1) * gutterSize) {
            estimatedNumberOfElements--;
        }

        var newWidth = estimatedNumberOfElements * elementWidth + gutterSize * (estimatedNumberOfElements - 1);

        artistsView.style.width = newWidth + 'px';

        if (packery) {
            packery.layout();
        }

        var modals = document.getElementsByClassName('modal');
        _.each(modals, function(modal) {
            modal.style.maxHeight = innerHeight + 'px';
        });
    }, 16);

    addEventListener('resize', onResize, false);
    onResize();
}

function modalShow(id) {
    if (!state.aModalIsShowing) {
        state.aModalIsShowing = true;
        state.scrollY = scrollY;
    }

    state.showingModals[id] = true;

    if (state.isMobile) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
    }

    document.activeElement.blur();

    var overlayNode = document.getElementById(id);
    overlayNode.style.display = 'table';
    setTimeout(function() {
        overlayNode.classList.remove('invisible');
    }, 50);
}

function modalHide(id) {
    delete state.showingModals[id];

    if (Object.keys(state.showingModals).length === 0) {
        if (state.isMobile) {
            document.body.style.overflow = 'auto';
            document.body.style.position = 'static';
        }

        state.aModalIsShowing = false;
        scrollTo(0, state.scrollY);
    }

    var overlayNode = document.getElementById(id);
    overlayNode.classList.add('invisible');
    setTimeout(function() {
        overlayNode.style.display = 'none';
    }, 400);
}

function prepareOverlays() {
    var modals = document.querySelectorAll('.overlay');
    _.each(modals, function(modal) {
        bindModalEvents(modal);
    });
}

function bindModalEvents(modal) {
    if (!modal)
        return;
    modal.querySelector('.gutter').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) {
            e.preventDefault();
            modalHide(modal.id);
        }
    }.bind(this), false);

    modal.querySelector('.modal .close').addEventListener('click', function(e) {
        e.preventDefault();

        modalHide(modal.id);
    }.bind(this), false);
}
