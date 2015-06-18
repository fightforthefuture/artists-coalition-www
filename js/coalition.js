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
    bandcamp: '',
    biography: '',
    category: null,
    discipline: null,
    email: '',
    facebook: '',
    imageBase64: null,
    imageFile: null,
    isMobile: /mobile/i.test(navigator.userAgent),
    isPreviewingForMobile: false,
    name: '',
    showingModals: {},
    socialLinkCount: 0,
    step: 1,
    tumblr: '',
    twitter: '',
};
var MAX_BIOGRAPHY_LENGTH = 256;
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
            if (!/^https?:\/\//.test(artistData.url)) {
                artistData.url = 'http://' + artistData.url;
            }

            artistData.socialHTML = generateSocialLinksHTML(artistData);

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

    var disciplinesButton = document.getElementById('disciplines-modal-button');
    var disciplinesOptions = document.getElementById('disciplines-modal-options');

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

    disciplinesOptions.addEventListener('click', function(e) {
        if (!e.target.classList.contains('option')) return;
        
        var id = e.target.getAttribute('data-id');
        var name = e.target.textContent.trim();

        state.discipline = id;

        modalHide('disciplines-modal');

        disciplinesButton.classList.remove('error');
        document.getElementById('discipline-label').textContent = name;
    }, false);

    // Populate categories.
    ajax.get('https://coalition-api.herokuapp.com/categories', function(res) {
        var template = _.template(document.getElementById('template:categories').innerHTML);
        
        var disciplines = JSON.parse(res);
        disciplinesOptions.innerHTML = template({ categories: disciplines });

        var categories = JSON.parse(res);
        categories.unshift({
            id: 0,
            name: 'All',
        });
        categoriesOptions.innerHTML = template({ categories: categories });
    });
}

var prepareStep = {
    '2': function() {
        var nameField = document.querySelector('#join-modal-form .step-2 .preview .name');
        nameField.textContent = state.name;
        nameField.href = state.website;

        var previewImg = document.querySelector('#join-modal-form .step-2 .preview .image');
        previewImg.style.backgroundImage = 'url(' + state.imageBase64 + ')';

        var count = document.querySelector('#join-modal-form .step-2 .limit .amount');
        count.textContent = MAX_BIOGRAPHY_LENGTH - state.name.length;
    },

    '3': function() {
        var nameField = document.querySelector('#join-modal-form .step-3 .preview .name');
        nameField.textContent = state.name;
        nameField.href = state.website;

        var previewImg = document.querySelector('#join-modal-form .step-3 .preview .image');
        previewImg.style.backgroundImage = 'url(' + state.imageBase64 + ')';

        var biographySpan = document.querySelector('#join-modal-form .step-3 .preview .biography');
        biographySpan.textContent = state.biography;
    },

    '4': function() {
        var step3Preview = document.querySelector('#join-modal-form .step-3 .preview');
        var step4Preview = document.querySelector('#join-modal-form .step-4 .preview');
        step4Preview.innerHTML = step3Preview.innerHTML;
    },
}

var validateStep = {
    '1': function() {
        if (!state.imageFile) {
            alert('Please select an image.');
            document.getElementById('upload-a-photo').classList.add('error');
            return false;
        }

        var nameField = document.getElementById('your-name-field');
        var name = nameField.value;
        if (!name) {
            alert('Please enter your name.');
            nameField.classList.add('error');
            nameField.focus();
            return false;
        }

        state.name = name;
        
        var websiteField = document.getElementById('your-website-field');
        var website = websiteField.value;
        if (!website) {
            alert('Please enter your website.');
            websiteField.classList.add('error');
            websiteField.focus();
            return false;
        }

        if (!/^https?:\/\//.test(website)) {
            website = 'http://' + website;
        }

        state.website = website;

        var disciplinesButton = document.getElementById('disciplines-modal-button');
        var discipline = state.discipline;
        if (!discipline) {
            alert('Please select a discipline.');
            disciplinesButton.classList.add('error');
            return false;
        }

        return true;
    },

    '2': function() {
        var biographyField = document.querySelector('#join-modal-form .step-2 textarea.biography');
        var biography = biographyField.value;
        if (!biography) {
            alert('Please write a description.');
            biographyField.classList.add('error');
            biographyField.focus();
            return false;
        }

        state.biography = biography.trim();

        return true;
    },
};

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

    function onTextFieldChange(e) {
        if (this.value) {
            this.classList.remove('error');
        } else {
            this.classList.add('error');
        }
    }
    _.each(document.querySelectorAll('#join-modal .step-1 .text-field'), function(textField) {
        textField.addEventListener('keyup', onTextFieldChange);
        textField.addEventListener('blur', onTextFieldChange);
    });

    document.getElementById('join-modal-form').addEventListener('submit', function(e) {
        e.preventDefault();

    }, false);

    function previous(e) {
        if (e) {
            e.preventDefault();
        }

        if (state.step === 1) {
            modalHide('join-modal');
            return;
        }

        state.step--;
        updateJoinModalStep();
    }

    document.querySelector('#join-modal .n').addEventListener('click', previous, false);

    function next(e) {
        if (e) {
            e.preventDefault();
        }

        if (validateStep[state.step] && !validateStep[state.step]()) {
            return;
        }

        if (state.step === 4) {
            sendSubmission();
            modalHide('join-modal');
            return;
        }

        state.step++;
        updateJoinModalStep();
    }

    document.querySelector('#join-modal .y').addEventListener('click', next, false);

    var uploadButton = document.getElementById('upload-a-photo');
    uploadButton.querySelector('input').addEventListener('change', onImageChange, false);

    document.getElementById('disciplines-modal-button').addEventListener('click', function(e) {
        e.preventDefault();

        modalShow('disciplines-modal');
    }, false);


    var count = document.querySelector('#join-modal-form .step-2 .limit .amount');
    var biographyField = document.querySelector('#join-modal-form .step-2 textarea.biography');
    var biographyPreview = document.querySelector('#join-modal-form .step-2 .preview .biography');
    var artistName = document.querySelector('#join-modal-form .step-2 .preview .name');

    function onKeyUpBiography(e) {
        var nameLength = artistName.textContent.length;
        var biographyLength = this.value.length;
        var totalLength = nameLength + biographyLength;

        if (totalLength > MAX_BIOGRAPHY_LENGTH) {
            biographyField.value = biographyField.value.substr(0, MAX_BIOGRAPHY_LENGTH);
            totalLength = MAX_BIOGRAPHY_LENGTH;
        }

        if (biographyLength === 0) {
            biographyPreview.textContent = '...';
            biographyField.classList.add('error');
        } else {
            biographyPreview.textContent = biographyField.value;
            biographyField.classList.remove('error');
        }

        var remaining = MAX_BIOGRAPHY_LENGTH - totalLength;
        count.textContent = remaining;
    }
    biographyField.addEventListener('blur', onKeyUpBiography);
    biographyField.addEventListener('keyup', onKeyUpBiography);

    var formStepTwo = document.querySelector('#join-modal-form .step-2');
    var previewButton = document.querySelector('#join-modal-form .step-2 .fields .preview-button');
    previewButton.addEventListener('click', function(e) {
        e.preventDefault();

        state.isPreviewingForMobile = true;
        formStepTwo.classList.add('previewing');
    }, false);
    var closePreviewButton = document.querySelector('#join-modal-form .step-2 .preview .close-preview-button');
    closePreviewButton.addEventListener('click', function(e) {
        e.preventDefault();

        state.isPreviewingForMobile = false;
        formStepTwo.classList.remove('previewing');
    }, false);

    var socialLinksButton = document.querySelector('#join-modal-form .step-3 .fields .social-links');
    socialLinksButton.addEventListener('click', function(e) {
        e.preventDefault();

        if (state.socialLinkCount === 3) return;

        modalShow('social-links-modal');
    }, false);

    var socialLinkTemplate = _.template(document.getElementById('template:social-link').innerHTML);
    document.querySelector('#social-links-modal .options').addEventListener('click', function(e) {
        if (!e.target.classList.contains('option')) return;
        if (e.target.classList.contains('disabled')) return;

        state.socialLinkCount++;

        var id = e.target.getAttribute('data-id');
        var name = e.target.textContent.trim();

        var div = document.createElement('div');
        var html = socialLinkTemplate({
            id: id,
            name: name,
            number: state.socialLinkCount,
        });
        div.innerHTML = html;

        var container = document.querySelector('#join-modal-form .step-3 .fields');
        container.appendChild(div);

        socialLinksButton.setAttribute('data-phase', state.socialLinkCount + 1);

        modalHide('social-links-modal');
        
        // Hide option
        setTimeout(function() {
            e.target.classList.add('disabled');
        }, 400);
    }, false);

    var socialLinkFields = document.querySelector('#join-modal-form .step-3 .fields');
    socialLinkFields.addEventListener('blur', onSocialLinkFieldChange, false);
    socialLinkFields.addEventListener('keyup', onSocialLinkFieldChange, false);
    var socialLinksPreview = document.querySelector('#join-modal-form .step-3 .preview .social-links');
    function onSocialLinkFieldChange(e) {
        var el = e.target;
        
        if (!el.classList.contains('social-link')) return;

        var id = el.getAttribute('data-id');
        state[id] = el.value.trim();

        var html = generateSocialLinksHTML(state);
        socialLinksPreview.innerHTML = html;
    }
}

function sendSubmission() {
    modalShow('uploading-modal');

    var data = new FormData();
    data.append('name', state.name);
    data.append('url', state.website);
    data.append('biography', state.biography);
    data.append('category_id', state.discipline);
    data.append('facebook', state.facebook);
    data.append('twitter', state.twitter);
    data.append('bandcamp', state.bandcamp);
    data.append('tumblr', state.tumblr);
    data.append('image', state.imageFile);
    ajax.post('https://coalition-api.herokuapp.com/artists/', data, function(res) {
        modalHide('uploading-modal');
        modalShow('uploaded-modal');
    });

}

var allowedSocialKeys = {
    'bandcamp': {
        name: 'Bandcamp',
        template: 'https://@.bandcamp.com',
    },
    'facebook': {
        name: 'Facebook',
        template: 'https://www.facebook.com/@',
    },
    'tumblr': {
        name: 'Tumblr',
        template: 'http://@.tumblr.com',
    },
    'twitter': {
        name: 'Twitter',
        template: 'https://twitter.com/@',
    },
};
function generateSocialLinksHTML(obj) {
    var count = 0;
    var html = '';

    _.each(allowedSocialKeys, function(socialSite, key) {
        if (!obj[key]) return;

        count++;

        if (count > 3) return;

        if (count > 1) {
            html += ' | ';
        }

        var url = obj[key];
        if (!/^https?:\/\//.test(url)) {
            if (url.match(key + '\.com')) {
                url = 'http://' + url;
            } else {
                url = url.replace('@', '');
                url = socialSite.template.replace('@', url);
            }
        }

        html += '<a class="social-link" href="' + url + '" target="_blank">' + socialSite.name + '</a>';
    });

    return html;
}

function onImageChange() {
    if (!this.files || !this.files[0]) {
        return;
    }

    var uploadButton = document.getElementById('upload-a-photo');

    var file = this.files[0];
    var reader = new FileReader();

    var previewImg = document.getElementById('uploaded-photo-preview');
    reader.onloadend = function() {
        if (file.type === 'image/png' || file.type === 'image/jpeg') {
            var image = new Image();
            image.src = reader.result;
            image.onload = function() {
                previewImg.style.backgroundImage = 'url(' + reader.result + ')';
                previewImg.style.display = 'block';
            }
        } else {
            previewImg.style.display = 'none';
            file = false;
        }

        if (file) {
            uploadButton.classList.add('selected');
            uploadButton.classList.remove('error');
            state.imageFile = file;
            state.imageBase64 = reader.result;
        } else {
            uploadButton.classList.remove('selected');
            uploadButton.classList.add('error');
            state.imageFile = null;
            alert('Please select a JPG or PNG image.')
        }
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
            if (prepareStep[state.step]) {
                prepareStep[state.step]();
            }

            label.classList.add('selected');
        } else {
            label.classList.remove('selected');
        }
    });

    // Update button labels.
    document.querySelector('#join-modal .buttons .n').value = buttonLabels.n[state.step - 1];
    document.querySelector('#join-modal .buttons .y').value = buttonLabels.y[state.step - 1];

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
            scrollTo(0, state.scrollY);
        }

        state.aModalIsShowing = false;
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
