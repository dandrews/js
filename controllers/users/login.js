var UserLoginController = FormController.extend({
	elements: {
		'input[name=username]': 'inp_username',
		'input[name=password]': 'inp_password'
	},

	buttons: false,
	formclass: 'user-login',

	init: function()
	{
		this.parent();
		turtl.push_title('Login');
		this.bind('release', turtl.pop_title.bind(null, false));
		this.render();
	},

	render: function()
	{
		var content = view.render('users/login');
		this.html(content);
		(function() { this.inp_username.focus(); }).delay(10, this);
	},

	submit: function(e)
	{
		if(e) e.stop();
		var username = this.inp_username.get('value');
		var password = this.inp_password.get('value');
		var user = new User({
			username: username,
			password: password
		});

		turtl.loading(true);
		user.test_auth().bind(this)
			.spread(function(id, meta) {
				var data = user.toJSON();
				data.id = id;
				turtl.user.set({
					username: user.get('username'),
					password: user.get('password')
				});
				turtl.user.login(data, {old: meta.old});
				if(meta.old)
				{
					barfr.barf('Your master key was generated using an older method. In order to improve your security, please generate a new key by going to the "Change password" section of your account settings. You can use the same username/password as before, but your key will be upgraded.', {persist: true});
				}
			})
			.catch(function(err) {
				barfr.barf('Login failed.');
				log.error('login error: ', derr(err));
				turtl.loading(false);
			})
			.finally(function() {
				turtl.loading(false);
			});
	}
});

