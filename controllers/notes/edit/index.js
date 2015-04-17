var NotesEditController = FormController.extend({
	elements: {
		'form': 'el_form',
		'input[name=title]': 'inp_title',
		'input[name=url]': 'inp_url',
		'textarea[name=text]': 'inp_text',
		'.boards-container': 'el_boards',
		'.existing': 'el_existing'
	},

	events: {
		'click .note-boards': 'open_boards',
		'click ul.colors li': 'switch_color',
		'click .button-row ul a[rel=tag]': 'open_tags',
		'click .button-row .desc': 'open_tags',
		'change form': 'detect_change',
		'input form': 'detect_change',
		'input input[name=url]': 'check_url',
		'click .formatting a[rel=formatting]': 'show_formatting_help'
	},

	modal: null,

	model: null,
	clone: null,
	formclass: 'notes-edit',
	button_tabindex: 9,
	footer_actions: [ {name: 'tag', icon: '&#xe80f;'} ],

	type: 'text',
	board_id: null,

	confirm_unsaved: false,
	have_unsaved: false,
	form_data: null,

	url_timer: null,

	init: function()
	{
		if(this.board_id == 'all') this.board_id = null;

		if(!this.model) this.model = new Note({
			boards: (this.board_id ? [this.board_id] : []),
			type: this.type || 'text'
		});
		this.clone = this.model.clone();

		this.action = this.model.is_new() ? 'Add' : 'Edit';
		this.parent();

		var title = '';
		switch(this.type)
		{
			case 'text': title = 'text note'; break;
			case 'link': title = 'bookmark'; break;
			default: title = this.type;
		}
		title = this.action + ' ' + title;
		this.modal = new TurtlModal({
			show_header: true,
			title: title
		});

		this.render();

		// track unsaved changes to the model
		this.form_data = this.el_form.toQueryString();
		var close = function()
		{
			if(this.confirm_unsaved && this.have_unsaved && !confirm('This note has unsaved changes. Really leave?')) return;
			this.modal.close();
		}.bind(this);

		this.modal.open(this.el);
		this.with_bind(this.modal, 'close', this.release.bind(this));
		this.bind(['cancel', 'close'], close);

		this.bind('release', function() {
			Autosize.destroy(this.inp_text);
		}.bind(this));

		// handle our "you have unsaved changes" state stuff
		var unsaved = function()
		{
			this.modal.set_title(title + ' <strong>*</strong>', turtl.last_url);
			this.have_unsaved = true;
			this.highlight_button();
		}.bind(this);
		this.bind('unsaved', unsaved);
		this.with_bind(this.clone, 'change', unsaved);
		this.with_bind(this.clone.get('tags'), ['add', 'remove'], unsaved);

		// basically copy tumblr's fixed footer tagging interface
		var footer_desc = function()
		{
			var tags = this.clone.get('tags').toJSON();
			if(tags.length)
			{
				this.set_desc(tags.join(', '));
			}
			else
			{
				this.set_desc('');
			}
		}.bind(this);
		this.with_bind(this.clone.get('tags'), ['add', 'remove'], footer_desc);
		footer_desc();

		if(this.model.is_new())
		{
			this.url_timer = new Timer(500);
			this.url_timer.bind('fired', function() {
				turtl.search.search({url: this.inp_url.get('value')}).bind(this)
					.spread(function(ids) {
						ids = ids.erase(this.model.id());
						if(!ids || !ids.length)
						{
							this.el_existing.slide('out');
							return;
						}

						var msg = '<em>!</em>';
						if(ids.length == 1)
						{
							msg += 'This URL is already bookmarked in a note';
						}
						else
						{
							msg += 'This URL is already bookmarked in '+ ids.length +' notes';
						}
						this.el_existing.set('html', msg);
						this.el_existing.slide('in');
					});
			}.bind(this));
			this.bind('check-url', this.url_timer.reset.bind(this.url_timer));
			this.bind('release', this.url_timer.unbind.bind(this.url_timer));
		}
	},

	render: function()
	{
		var type = this.model.get('type') || this.type;
		// "none" is vestigial, leave it in
		var colors = ['none','blue','red','green','purple','pink','brown','black'];
		var data = this.model.toJSON();
		if(!data.color) delete data.color;
		Autosize.destroy(this.inp_text);

		this.html(view.render('notes/edit/index', {
			note: data,
			show_url: ['image', 'link'].contains(type),
			type: this.model.get('type') || this.type,
			colors: colors
		}));

		if(this.model.is_new())
		{
			var focus_el = null;
			switch(this.type)
			{
				case 'text': focus_el = this.inp_text; break;
				case 'link': focus_el = this.inp_url; break;
				case 'image': focus_el = this.inp_url; break;
			}
			// NOTE: the delay here is same as CSS transition
			//
			// without this, the modal will jump forward to the textarea whlie
			// sliding in, making the transition look really ugly and stupid.
			// beware!
			if(focus_el) setTimeout(focus_el.focus.bind(focus_el), 300);
		}

		if(this.inp_text) setTimeout(function() { autosize(this.inp_text); }.bind(this), 10);

		this.track_subcontroller('boards', function() {
			return new NotesEditBoardsListController({
				inject: this.el_boards,
				model: this.clone
			});
		}.bind(this));

		if(this.el_existing)
		{
			this.check_url();
			this.el_existing.set('slide', {duration: 300});
			this.el_existing.get('slide').hide();
		}
	},

	submit: function(e)
	{
		if(e) e.stop();

		var errors = [];

		var title = this.inp_title.get('value');
		var url = this.inp_url && this.inp_url.get('value');
		var text = this.inp_text.get('value');

		var data = {
			title: title,
			url: url,
			text: text
		};

		var keypromise = Promise.resolve();
		if(this.model.is_new())
		{
			keypromise = this.model.init_new({board_id: this.board_id, silent: true});
		}

		var clone = this.clone;
		clone.set(data);
		keypromise.bind(this)
			.then(function() {
				return clone.save();
			})
			.then(function() {
				this.model.set(clone.toJSON());
				this.have_unsaved = false;

				// add the note to our main note list
				turtl.profile.get('notes').upsert(this.model);

				this.trigger('close');
			})
			.catch(function(err) {
				turtl.events.trigger('ui-error', 'There was a problem updating that note', err);
				log.error('note: edit: ', this.model.id(), derr(err));
			});
	},

	check_url: function(e)
	{
		this.trigger('check-url');
	},

	switch_color: function(e)
	{
		if(e) e.stop();
		var li = Composer.find_parent('ul.colors li', e.target);
		if(!li) return;
		var selected = li.hasClass('sel');
		this.el.getElements('ul.colors li').each(function(el) { el.removeClass('sel'); });
		var color = parseInt(li.get('rel'));
		if(selected)
		{
			color = 0;
		}
		else
		{
			if(color > 0)
			{
				li.addClass('sel');
			}
		}
		this.clone.set({color: color});
	},

	open_boards: function(e)
	{
		if(e) e.stop();
		new NotesEditBoardsController({
			model: this.clone
		});
	},

	open_tags: function(e)
	{
		if(e) e.stop();
		new NotesEditTagsController({
			model: this.clone
		});
	},

	detect_change: function(e)
	{
		var ser = this.el_form.toQueryString();
		if(ser == this.form_data) return;
		this.trigger('unsaved');
	},

	show_formatting_help: function(e)
	{
		if(e) e.stop();
		new MarkdownFormattingHelpController();
	}
});

