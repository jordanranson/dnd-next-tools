var _spells = null;

Handlebars.registerHelper('listClasses', function(classes) {
    var value = '';
    for(var key in classes) {
        if(classes[key] === 'highlight') value += '<span class="term">'+key+'</span><span class="comma">, </span>';
        else if(classes[key]) value += key+'<span class="comma">, </span>';
    }
    return value;
});

Handlebars.registerHelper('totalValue', function(value, qty) {
    return formatGold(value * qty);
});

Handlebars.registerHelper('displayValue', function(value) {
    return formatGold(value);
});

String.uuid = (function() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return function() {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    };
})();

function formatGold(amount) {
    var string = '';

    /*string += amount % (100 * 100 * 100);
     string += 'g ';
     string += amount / 100 % (100 * 100 * 100);
     string += 's ';
     string += amount % (100 * 100 * 100);
     string += 'c ';*/

    var gold   = Math.floor(amount / 100 / 100);
    var silver = Math.floor(((amount  - (gold * 100 * 100)) / 100));
    var copper = amount - (gold * 100 * 100) - (silver * 100);

    if(gold   > 0) string += gold   + 'g ';
    if(silver > 0) string += silver + 's ';
    if(copper > 0) string += copper + 'c ';

    return string;
}

function renderSpellList(data) {
    var source        = $("#spellTemplate").html();
    var template      = Handlebars.compile(source);
    var html          = template({ spells: data });
    var $xSpells      = $('.x-spells');

    $xSpells.html(html);
}

function findMatch(str, query) {
    return !!~(str.toString().toLowerCase().search(query));
}

function loadSpellList(data, query) {
    renderSpellList(data);

    var $xSpellSearch = $('.x-spell-search');
    $xSpellSearch.val(query || '');
    $xSpellSearch.trigger('keyup');
}

function onDrop(e) {
    e.preventDefault();

    var file = e.dataTransfer.files[0];
    var reader = new FileReader();
    reader.onload = function () {
        var data = JSON.parse(this.result);
        _spells = data;
        loadSpellList(data);
    };
    reader.readAsText(file);
}

function onDragOver(e) {
    return false;
}

function onDragEnd(e) {
    return false;
}

function render(selector, model, $container) {
    var source   = $(selector).html();
    var template = Handlebars.compile(source);
    var html     = template(model);
    $container.html(html);
}

function loadInventoryPanel() {
    var $xItemContainers = $('.x-item-containers');
    var backpack = {
        id    : String.uuid(),
        name  : "Adventurer's Backpack",
        items : []
    };
    var containerData  = JSON.parse(localStorage.getItem('inventory_data')) || [backpack];
    var containerModel = { containers: containerData };

    localStorage.setItem('inventory_data', JSON.stringify(containerData));

    render('#itemContainerTemplate', containerModel, $xItemContainers);
}

function loadSpellPanel(query) {
    if(!_spells) {
        $.get('./spells.json')
            .success(function(data) {
                _spells = data;
                loadSpellList(data, query);
            });
    }
    else {
        loadSpellList(_spells, query);
    }
}

function loadSpellbookPanel(sortBy) {
    var $xSpellbook    = $('.x-spellbook');
    var spellbookData  = JSON.parse(localStorage.getItem('spellbook_data')) || [];

    var spellbookModel = { spells: _.sortBy(spellbookData, function(item) {
        return (sortBy && item[sortBy.value]) || item.name;
    })};
    if(sortBy && sortBy.desc) spellbookModel.spells.reverse();

    localStorage.setItem('spellbook_data', JSON.stringify(spellbookData));
    render('#spellbookTemplate', spellbookModel, $xSpellbook);
}

function route(container) {
    switch(container) {
        case '.x-inventory-panel' : loadInventoryPanel(); break;
        case '.x-spell-panel'     : loadSpellPanel(); break;
        case '.x-spellbook-panel' : loadSpellbookPanel(); break;
    }
}

$(function() {
    var $body = $('body');

    var $xDropTarget = $('.x-drop-target');
    $xDropTarget.on('dragover', onDragOver);
    $xDropTarget.on('dragend',  onDragEnd);
    $xDropTarget[0].addEventListener('drop', onDrop);

    $('.x-spell-nav').addClass('active');
    route('.x-spell-panel');

    $body.on('click', '.x-nav-a', function(e) {
        var $tar = $(e.target);
        var forContainer = '.'+$tar.attr('data-for');

        $('.x-content-panel').hide();
        $(forContainer).show();

        $('.x-nav a').removeClass('active');
        $tar.addClass('active');

        route(forContainer);
    });

    var timer;
    var $xSpellSearch = $('.x-spell-search');
    $xSpellSearch.on('keyup', function(e) {
        clearTimeout(timer);
        timer = setTimeout(function() {
            var rawQuery = $(e.target).val();
            while(!!~rawQuery.search(', ')) {
                rawQuery = rawQuery.replace(', ', ',')
            }

            var queryArr = rawQuery.split(',');

            var filteredData = _.filter(JSON.parse(JSON.stringify(_spells)), function(spell) {
                var matched = [];

                for(var i = 0; i < queryArr.length; i++) {
                    var queryParams = queryArr[i].toLowerCase().split('|');


                    for(var w = 0; w < queryParams.length; w++) {
                        var query = queryParams[w];
                        var next = false;

                        if (!next && query.length < 3) {
                            next = true;
                        }

                        if (!next && query === '') {
                            matched.push(true);
                            next = true;
                        }

                        if (!next) {
                            if (query === 'cantrip' && spell.level == 0) {
                                matched.push(true);
                                next = true;
                            }
                        }

                        if (!next) {
                            if (query === 'ritual' && spell.ritual) {
                                matched.push(true);
                                next = true;
                            }
                        }

                        if (!next) {
                            for (var x = 0; x < 10; x++) {
                                if (query === 'level ' + x && spell.level == x) {
                                    matched.push(true);
                                    next = true;
                                    break;
                                }
                            }
                        }

                        if (!next) {
                            for (var spellClass in spell.classes) {
                                if (query === spellClass) {
                                    matched.push(true);
                                    next = true;
                                    break;
                                }
                            }
                        }

                        if (!next) {
                            for (var key in spell) {
                                if (findMatch(spell[key], query)) {
                                    matched.push(true);
                                    next = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                return rawQuery === '' ? true : matched.length >= queryArr.length;
            });

            if(rawQuery !== '') {
                for(var k = 0; k < filteredData.length; k++) {
                    var spell = filteredData[k];

                    for(var i = 0; i < queryArr.length; i++) {
                        var queryParams = queryArr[i].split('|');

                        for(var w = 0; w < queryParams.length; w++) {
                            var query = queryParams[w];

                            if (query.trim() !== '') {
                                for (var j in spell) {
                                    var string = spell[j].toString();
                                    if (!!~string.search(query))
                                        spell[j] = string.replace(query, '<span class="term">' + query + '</span>');

                                    if (!!~string.search(query.charAt(0).toUpperCase() + query.slice(1)))
                                        spell[j] = string.replace(query.charAt(0).toUpperCase() + query.slice(1), '<span class="term">' + query.charAt(0).toUpperCase() + query.slice(1) + '</span>');

                                    if (!!~string.search(query.toLowerCase()))
                                        spell[j] = string.replace(query.toLowerCase(), '<span class="term">' + query.toLowerCase() + '</span>');

                                    if (!!~string.search(query.toUpperCase()))
                                        spell[j] = string.replace(query.toUpperCase(), '<span class="term">' + query.toUpperCase() + '</span>');
                                }
                            }

                            for (var j in spell.classes) {
                                if (j == query) filteredData[k].classes[j] = 'highlight';
                            }
                        }
                    }
                }
            }

            renderSpellList(filteredData);
        }, 350);
    });


    /*
     * Inventory
     */

    $body.on('click', '.x-add-item-container', function(e) {
        var $xContainerName = $('.x-container-name');
        var containerName   = $xContainerName.val().trim();

        if(containerName.length === 0) return;

        var container = {
            id    : String.uuid(),
            name  : containerName,
            items : []
        };

        var containers = JSON.parse(localStorage.getItem('inventory_data'));
        containers.push(container);

        localStorage.setItem('inventory_data', JSON.stringify(containers));
        route('.x-inventory-panel');
    });

    $body.on('click', '.x-remove-container', function(e) {
        if(!confirm('Are you sure you want to destroy this container?')) return;

        var $tar = $(e.target);
        var id   = $tar.closest('.x-item-container').attr('data-id');

        var containers = JSON.parse(localStorage.getItem('inventory_data'));
        for(var i = 0; i < containers.length; i++) {
            var c = containers[i];
            if(c.id === id) {
                containers.splice(i, 1);
                break;
            }
        }

        localStorage.setItem('inventory_data', JSON.stringify(containers));
        route('.x-inventory-panel');
    });

    $body.on('click', '.x-clear-inventory', function(e) {
        if(!confirm('Are you sure you want reset your inventory?')) return;

        localStorage.removeItem('inventory_data');
        route('.x-inventory-panel');
    });

    $body.on('click', '.x-add-item', function(e) {
        var $tar   = $(e.target);
        var $table = $tar.closest('table');

        var id     = $tar.closest('.x-item-container').attr('data-id');
        var name   = $table.find('.x-item-name').val();
        var qty    = $table.find('.x-item-qty').val();
        var value  = $table.find('.x-item-value').val();

        if(!!~value.search('c')) value = value.toString().replace('c', '').trim();
        else if(!!~value.search('s')) value = Number(value.toString().replace('s', '').trim()) * 100;
        else value = Number(value.toString().replace('g', '').trim()) * 100 * 100;

        if(name === '' || !(Number(qty) >= 0) || !(Number(value) >= 0) ) return;

        //value = value.split('.');
        //value = value[0] * (value[1] * 100) + (value[2] * 100 * 100);

        var containers = JSON.parse(localStorage.getItem('inventory_data'));
        for(var i = 0; i < containers.length; i++) {
            var c = containers[i];
            if(c.id === id) {
                c.items.push({
                    id    : String.uuid(),
                    name  : name,
                    qty   : qty,
                    value : value
                });
                break;
            }
        }

        localStorage.setItem('inventory_data', JSON.stringify(containers));
        route('.x-inventory-panel');
    });

    $body.on('click', '.x-remove-item', function(e) {
        if(!confirm('Are you sure you want to destroy this item?')) return;

        var $tar = $(e.target);
        var cid  = $tar.closest('.x-item-container').attr('data-id');
        var iid  = $tar.closest('.x-item-row').attr('data-id');

        var containers = JSON.parse(localStorage.getItem('inventory_data'));
        for(var i = 0; i < containers.length; i++) {
            var c = containers[i];
            if(c.id === cid) {
                for(var k = 0; k < c.items.length; k++) {
                    var item = c.items[k];
                    if(item.id === iid) {
                        c.items.splice(k,1);
                        break;
                    }
                }
            }
        }

        localStorage.setItem('inventory_data', JSON.stringify(containers));
        route('.x-inventory-panel');
    });

    $body.on('click', '.x-change-item-qty', function(e) {
        var amount = prompt('Adjust quantity by how much?');
        if(typeof amount !== 'number' && !~amount.toString().search('.')) return;

        var $tar = $(e.target);
        var cid  = $tar.closest('.x-item-container').attr('data-id');
        var iid  = $tar.closest('.x-item-row').attr('data-id');

        var containers = JSON.parse(localStorage.getItem('inventory_data'));
        for(var i = 0; i < containers.length; i++) {
            var c = containers[i];
            if(c.id === cid) {
                for(var k = 0; k < c.items.length; k++) {
                    var item = c.items[k];
                    if(item.id === iid) {
                        item.qty = Number(item.qty) + Number(amount);
                        break;
                    }
                }
            }
        }

        localStorage.setItem('inventory_data', JSON.stringify(containers));
        route('.x-inventory-panel');
    });


    /*
     * Spell book
     */

    $body.on('click', '.x-add-spell', function(e) {
        var $tar = $(e.target);

        var spellbook = JSON.parse(localStorage.getItem('spellbook_data'));
        var spell     = {
            id    : String.uuid(),
            name  : $tar.closest('table').find('.x-spell-name').val(),
            level : $tar.closest('table').find('.x-spell-level').val()
        };
        spellbook.push(spell);

        localStorage.setItem('spellbook_data', JSON.stringify(spellbook));
        route('.x-spellbook-panel');
    });

    $body.on('click', '.x-add-spell-list', function(e) {
        var $tar = $(e.target);

        var spellbook = JSON.parse(localStorage.getItem('spellbook_data'));
        var spell     = {
            id    : String.uuid(),
            name  : $tar.closest('.spell').attr('data-name'),
            level : $tar.closest('.spell').attr('data-level')
        };
        spellbook.push(spell);
        localStorage.setItem('spellbook_data', JSON.stringify(spellbook));

        if(confirm('Spell learned! View Spell Book?')) {
            $('.x-content-panel').hide();
            $('.x-spellbook-panel').show();

            $('.x-nav a').removeClass('active');
            $('.x-spellbook-nav').addClass('active');

            route('.x-spellbook-panel');
        }
    });

    $body.on('click', '.x-remove-spell', function(e) {
        if(!confirm('Are you sure you want to forget this spell?')) return;

        var $tar = $(e.target);
        var id   = $tar.closest('.x-item-row').attr('data-id');

        var spellbook = JSON.parse(localStorage.getItem('spellbook_data'));
        for(var i = 0; i < spellbook.length; i++) {
            console.log(spellbook[i]);
            if(spellbook[i].id == id) {
                spellbook.splice(i, 1);
                break;
            }
        }

        localStorage.setItem('spellbook_data', JSON.stringify(spellbook));
        route('.x-spellbook-panel');
    });

    $body.on('click', '.x-view-spell', function(e) {
        var $tar = $(e.target);
        var spellName = $tar.closest('.x-item-row').attr('data-name');

        $('.x-content-panel').hide();
        $('.x-spell-panel').show();

        $('.x-nav a').removeClass('active');
        $('.x-spell-nav').addClass('active');

        loadSpellPanel(spellName);
    });

    $body.on('click', '.x-clear-spellbook', function(e) {
        if(!confirm('Are you sure you want reset your spell book?')) return;

        localStorage.removeItem('spellbook_data');
        route('.x-spellbook-panel');
    });

    var sortLevelDesc = false;
    $body.on('click', '.x-sort-spell-level', function(e) {
        loadSpellbookPanel({ value: 'level', desc: sortLevelDesc });
        sortLevelDesc = !sortLevelDesc
    });

    var sortNameDesc = false;
    $body.on('click', '.x-sort-spell-name', function(e) {
        loadSpellbookPanel({ value: 'name', desc: sortNameDesc });
        sortNameDesc = !sortNameDesc
    });


    /*
     * Utilities
     */

    $body.on('click', '.x-export', function() {
        var data = {
            'inventory_data' : localStorage.getItem('inventory_data') || [],
            'spellbook_data' : localStorage.getItem('spellbook_data') || []
        };

        prompt('Export data', JSON.stringify(data));
    });

    $body.on('click', '.x-import', function() {
        var data = JSON.parse(prompt('Import data'));
        
        localStorage.setItem('inventory_data', data.inventory_data);
        localStorage.setItem('spellbook_data', data.spellbook_data);

        window.location.reload();
    });
});